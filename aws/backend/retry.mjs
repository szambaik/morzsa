// Retry only rejected conditional writes. Provider calls must stay outside this
// boundary, and each attempt must load a new transaction snapshot.
export async function retryConflict(operation){
 for(let attempt=0;;attempt++){
  try{return await operation();}
  catch(error){
   const rejectedTransaction=error.name==='TransactionConflictException'||error.name==='TransactionCanceledException'&&error.CancellationReasons?.some(r=>r.Code==='TransactionConflict');
   if(!(error.status===409&&error.retryable===true||rejectedTransaction)||attempt>=3)throw error;
   await new Promise(resolve=>setTimeout(resolve,25*(attempt+1)+Math.floor(Math.random()*50)));
  }
 }
}

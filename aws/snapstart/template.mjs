// CloudFormation packaging resolves Code paths relative to build/template.json.
export function createTemplate(buildId) {
  if (!/^[a-f0-9]{16}$/.test(buildId)) throw new Error('Invalid build ID');
  const resources={
    ProbeRole:{Type:'AWS::IAM::Role',Properties:{
      AssumeRolePolicyDocument:{Version:'2012-10-17',Statement:[{Effect:'Allow',
        Principal:{Service:'lambda.amazonaws.com'},Action:'sts:AssumeRole'}]},
      Policies:[{PolicyName:'WriteProbeLogs',PolicyDocument:{Version:'2012-10-17',Statement:[{
        Effect:'Allow',Action:['logs:CreateLogStream','logs:PutLogEvents'],
        Resource:{'Fn::Sub':'arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/lambda/${AWS::StackName}-*:log-stream:*'}
      }]}}]
    }}
  };
  const outputs={};
  for (const [name,runtime,code,handler,snap] of [
    ['JavaSnap','java21','java-probe.zip','morzsa.aws.Probe::handleRequest',true],
    ['JavaPlain','java21','java-probe.zip','morzsa.aws.Probe::handleRequest',false],
    ['NodePlain','nodejs22.x','node-probe.zip','index.handler',false]
  ]) {
    resources[name+'Logs']={Type:'AWS::Logs::LogGroup',Properties:{
      LogGroupName:{'Fn::Sub':'/aws/lambda/${AWS::StackName}-'+name},RetentionInDays:7}};
    resources[name]={Type:'AWS::Lambda::Function',DependsOn:name+'Logs',Properties:{
      FunctionName:{'Fn::Sub':'${AWS::StackName}-'+name},Runtime:runtime,
      Architectures:['x86_64'],Handler:handler,Role:{'Fn::GetAtt':['ProbeRole','Arn']},
      MemorySize:256,Timeout:10,Code:code,
      ...(snap?{SnapStart:{ApplyOn:'PublishedVersions'}}:{})
    }};
    const version=name+'Version'+buildId;
    resources[version]={Type:'AWS::Lambda::Version',Properties:{
      FunctionName:{Ref:name},Description:'Runtime probe build '+buildId}};
    resources[name+'Alias']={Type:'AWS::Lambda::Alias',Properties:{
      Name:'probe',FunctionName:{Ref:name},FunctionVersion:{'Fn::GetAtt':[version,'Version']}}};
    outputs[name]={Value:{Ref:name+'Alias'}};
  }
  return {AWSTemplateFormatVersion:'2010-09-09',Description:
    'Morzsa isolated IAM-only SnapStart runtime benchmark; no application data or public endpoints',
    Resources:resources,Outputs:outputs};
}

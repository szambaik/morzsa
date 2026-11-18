export function voiceResources(){return {
 VoiceLogs:{Type:'AWS::Logs::LogGroup',Properties:{LogGroupName:{'Fn::Sub':'/aws/lambda/${AWS::StackName}-voice-monitor'},RetentionInDays:7}},
 VoiceRole:{Type:'AWS::IAM::Role',Properties:{AssumeRolePolicyDocument:{Version:'2012-10-17',Statement:[{Effect:'Allow',Principal:{Service:'lambda.amazonaws.com'},Action:'sts:AssumeRole'}]},Policies:[{PolicyName:'MonitorKnownRealtimeCalls',PolicyDocument:{Version:'2012-10-17',Statement:[
  {Effect:'Allow',Action:['dynamodb:GetItem','dynamodb:Query','dynamodb:PutItem','dynamodb:ConditionCheckItem'],Resource:{'Fn::GetAtt':['Data','Arn']},Condition:{'ForAllValues:StringLike':{'dynamodb:LeadingKeys':['APP#*']},Null:{'dynamodb:LeadingKeys':false}}},
  {Effect:'Allow',Action:['s3:GetObject'],Resource:[{'Fn::Sub':'${Media.Arn}/ai/*'},{'Fn::Sub':'${Media.Arn}/entities/*'}]},
  {Effect:'Allow',Action:['s3:PutObject'],Resource:{'Fn::Sub':'${Media.Arn}/entities/*'}},
  {Effect:'Allow',Action:['secretsmanager:GetSecretValue'],Resource:{Ref:'ProviderSecret'}},
  {Effect:'Allow',Action:['logs:CreateLogStream','logs:PutLogEvents'],Resource:{'Fn::Sub':'arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/lambda/${AWS::StackName}-voice-monitor:log-stream:*'}}
 ]}}]}},
 VoiceFunction:{Type:'AWS::Lambda::Function',DependsOn:'VoiceLogs',Properties:{FunctionName:{'Fn::Sub':'${AWS::StackName}-voice-monitor'},Runtime:'nodejs22.x',Architectures:['arm64'],MemorySize:256,Timeout:130,ReservedConcurrentExecutions:2,Handler:'voice-monitor.handler',Role:{'Fn::GetAtt':['VoiceRole','Arn']},Code:'voice-monitor.zip',Environment:{Variables:{DATA_TABLE:{Ref:'Data'},MEDIA_BUCKET:{Ref:'Media'},PROVIDER_SECRET:{Ref:'ProviderSecret'}}}}}
};}

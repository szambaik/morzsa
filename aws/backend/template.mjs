import {aiResources} from './ai-resources.mjs';
import {voiceResources} from './voice-resources.mjs';
export function backendTemplate() {
 const resources={
  ProviderSecret:{Type:'AWS::SecretsManager::Secret',DeletionPolicy:'Retain',UpdateReplacePolicy:'Retain',Properties:{Description:'Morzsa independent AWS AI provider configuration'}},
  Data:{Type:'AWS::DynamoDB::Table',DeletionPolicy:'Retain',UpdateReplacePolicy:'Retain',Properties:{
   BillingMode:'PAY_PER_REQUEST',DeletionProtectionEnabled:true,
   PointInTimeRecoverySpecification:{PointInTimeRecoveryEnabled:true},
   AttributeDefinitions:[{AttributeName:'PK',AttributeType:'S'},{AttributeName:'SK',AttributeType:'S'}],
   KeySchema:[{AttributeName:'PK',KeyType:'HASH'},{AttributeName:'SK',KeyType:'RANGE'}],
   TimeToLiveSpecification:{AttributeName:'expiresAt',Enabled:true},SSESpecification:{SSEEnabled:true},OnDemandThroughput:{MaxReadRequestUnits:{Ref:'ReadCap'},MaxWriteRequestUnits:{Ref:'WriteCap'}}
  }},
  Media:{Type:'AWS::S3::Bucket',DeletionPolicy:'Retain',UpdateReplacePolicy:'Retain',Properties:{
   PublicAccessBlockConfiguration:{BlockPublicAcls:true,BlockPublicPolicy:true,IgnorePublicAcls:true,RestrictPublicBuckets:true},
   BucketEncryption:{ServerSideEncryptionConfiguration:[{ServerSideEncryptionByDefault:{SSEAlgorithm:'AES256'}}]},
   VersioningConfiguration:{Status:'Enabled'},
   CorsConfiguration:{CorsRules:[{AllowedOrigins:['https://szambaik.github.io','http://localhost'],AllowedMethods:['GET','PUT','HEAD'],AllowedHeaders:['Content-Type'],MaxAge:300}]}
  }},
  MediaPolicy:{Type:'AWS::S3::BucketPolicy',Properties:{Bucket:{Ref:'Media'},PolicyDocument:{Version:'2012-10-17',Statement:[{
   Effect:'Deny',Principal:'*',Action:'s3:*',Resource:[{'Fn::GetAtt':['Media','Arn']},{'Fn::Sub':'${Media.Arn}/*'}],Condition:{Bool:{'aws:SecureTransport':false}}
  }]}}},
  Users:{Type:'AWS::Cognito::UserPool',DeletionPolicy:'Retain',UpdateReplacePolicy:'Retain',Properties:{
   UserPoolName:{'Fn::Sub':'${AWS::StackName}'},UserPoolTier:'LITE',DeletionProtection:'ACTIVE',
   UsernameConfiguration:{CaseSensitive:false},AutoVerifiedAttributes:['email'],
   AccountRecoverySetting:{RecoveryMechanisms:[{Name:'verified_email',Priority:1}]},
   Policies:{PasswordPolicy:{MinimumLength:12,RequireLowercase:true,RequireUppercase:true,RequireNumbers:true,RequireSymbols:true}},
   MfaConfiguration:'OPTIONAL',EnabledMfas:['SOFTWARE_TOKEN_MFA'],
   Schema:[{Name:'app_user_id',AttributeDataType:'String',Mutable:false,StringAttributeConstraints:{MinLength:'36',MaxLength:'36'}}]
  }},
  Client:{Type:'AWS::Cognito::UserPoolClient',Properties:{
   UserPoolId:{Ref:'Users'},GenerateSecret:false,PreventUserExistenceErrors:'ENABLED',
   SupportedIdentityProviders:['COGNITO','Google'],AllowedOAuthFlowsUserPoolClient:true,AllowedOAuthFlows:['code'],
   AllowedOAuthScopes:['openid','email','profile','aws.cognito.signin.user.admin'],
   CallbackURLs:['https://szambaik.github.io/morzsa/','io.github.szambaik.morzsa://auth-callback','http://localhost:8080/'],
   LogoutURLs:['https://szambaik.github.io/morzsa/','http://localhost:8080/'],
   ExplicitAuthFlows:['ALLOW_USER_PASSWORD_AUTH','ALLOW_USER_SRP_AUTH','ALLOW_REFRESH_TOKEN_AUTH'],
   AccessTokenValidity:15,IdTokenValidity:15,RefreshTokenValidity:7,
   TokenValidityUnits:{AccessToken:'minutes',IdToken:'minutes',RefreshToken:'days'},
   EnableTokenRevocation:true,RefreshTokenRotation:{Feature:'DISABLED'},
   ReadAttributes:['email','email_verified','custom:app_user_id'],WriteAttributes:['email']
  }},
  Domain:{Type:'AWS::Cognito::UserPoolDomain',Properties:{UserPoolId:{Ref:'Users'},Domain:{'Fn::Sub':'${AWS::StackName}-${AWS::AccountId}'},ManagedLoginVersion:1}},
  Logs:{Type:'AWS::Logs::LogGroup',Properties:{LogGroupName:{'Fn::Sub':'/aws/lambda/${AWS::StackName}-data'},RetentionInDays:7}},
  Role:{Type:'AWS::IAM::Role',Properties:{AssumeRolePolicyDocument:{Version:'2012-10-17',Statement:[{Effect:'Allow',Principal:{Service:'lambda.amazonaws.com'},Action:'sts:AssumeRole'}]},Policies:[{PolicyName:'ReadOnlyApplicationData',PolicyDocument:{Version:'2012-10-17',Statement:[
   {Effect:'Allow',Action:['dynamodb:GetItem','dynamodb:Query','dynamodb:BatchGetItem'],Resource:{'Fn::GetAtt':['Data','Arn']},Condition:{'ForAllValues:StringLike':{'dynamodb:LeadingKeys':['APP#*','META#*','IDENTITY#*']},Null:{'dynamodb:LeadingKeys':false}}},
   {Effect:'Allow',Action:['s3:GetObject'],Resource:[{'Fn::Sub':'${Media.Arn}/objects/*'},{'Fn::Sub':'${Media.Arn}/entities/*'}]},
   {Effect:'Allow',Action:['s3:PutObject'],Resource:[{'Fn::Sub':'${Media.Arn}/entities/*'},{'Fn::Sub':'${Media.Arn}/objects/chat-media/*'}]},
   {Effect:'Allow',Action:['dynamodb:PutItem','dynamodb:ConditionCheckItem'],Resource:{'Fn::GetAtt':['Data','Arn']},Condition:{'ForAllValues:StringLike':{'dynamodb:LeadingKeys':['APP#*']},Null:{'dynamodb:LeadingKeys':false}}},
   {Effect:'Allow',Action:['logs:CreateLogStream','logs:PutLogEvents'],Resource:{'Fn::Sub':'arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/lambda/${AWS::StackName}-data:log-stream:*'}}
  ]}}]}},
  ApiFunction:{Type:'AWS::Lambda::Function',DependsOn:'Logs',Properties:{FunctionName:{'Fn::Sub':'${AWS::StackName}-data'},Runtime:'nodejs22.x',Architectures:['arm64'],MemorySize:256,Timeout:15,ReservedConcurrentExecutions:5,Handler:'api.handler',Role:{'Fn::GetAtt':['Role','Arn']},Code:'api.zip',Environment:{Variables:{DATA_TABLE:{Ref:'Data'},MEDIA_BUCKET:{Ref:'Media'},USER_POOL:{Ref:'Users'},APP_CLIENT:{Ref:'Client'},WRITE_ENABLED:'true'}}}},
  Api:{Type:'AWS::ApiGatewayV2::Api',Properties:{Name:{'Fn::Sub':'${AWS::StackName}'},ProtocolType:'HTTP'}},
  Integration:{Type:'AWS::ApiGatewayV2::Integration',Properties:{ApiId:{Ref:'Api'},IntegrationType:'AWS_PROXY',IntegrationUri:{'Fn::GetAtt':['ApiFunction','Arn']},PayloadFormatVersion:'2.0',TimeoutInMillis:15000}},
  Authorizer:{Type:'AWS::ApiGatewayV2::Authorizer',Properties:{ApiId:{Ref:'Api'},AuthorizerType:'JWT',Name:'CognitoAccessToken',IdentitySource:['$request.header.Authorization'],JwtConfiguration:{Audience:[{Ref:'Client'}],Issuer:{'Fn::Sub':'https://cognito-idp.${AWS::Region}.amazonaws.com/${Users}'}}}},
  Stage:{Type:'AWS::ApiGatewayV2::Stage',Properties:{ApiId:{Ref:'Api'},StageName:'$default',AutoDeploy:true,DefaultRouteSettings:{ThrottlingRateLimit:20,ThrottlingBurstLimit:40}}},
  HealthRoute:{Type:'AWS::ApiGatewayV2::Route',Properties:{ApiId:{Ref:'Api'},RouteKey:'GET /health',Target:{'Fn::Sub':'integrations/${Integration}'}}},
  OptionsRoute:{Type:'AWS::ApiGatewayV2::Route',Properties:{ApiId:{Ref:'Api'},RouteKey:'OPTIONS /{proxy+}',Target:{'Fn::Sub':'integrations/${Integration}'}}},
  ProtectedRoute:{Type:'AWS::ApiGatewayV2::Route',Properties:{ApiId:{Ref:'Api'},RouteKey:'$default',Target:{'Fn::Sub':'integrations/${Integration}'},AuthorizationType:'JWT',AuthorizerId:{Ref:'Authorizer'},AuthorizationScopes:['aws.cognito.signin.user.admin']}},
  ApiPermission:{Type:'AWS::Lambda::Permission',Properties:{FunctionName:{Ref:'ApiFunction'},Action:'lambda:InvokeFunction',Principal:'apigateway.amazonaws.com',SourceAccount:{Ref:'AWS::AccountId'},SourceArn:{'Fn::Sub':'arn:${AWS::Partition}:execute-api:${AWS::Region}:${AWS::AccountId}:${Api}/*'}}},
  ImportLogs:{Type:'AWS::Logs::LogGroup',Properties:{LogGroupName:{'Fn::Sub':'/aws/lambda/${AWS::StackName}-import'},RetentionInDays:7}},
  ImportRole:{Type:'AWS::IAM::Role',Properties:{AssumeRolePolicyDocument:{Version:'2012-10-17',Statement:[{Effect:'Allow',Principal:{Service:'lambda.amazonaws.com'},Action:'sts:AssumeRole'}]},Policies:[{PolicyName:'ImportVerifiedSnapshot',PolicyDocument:{Version:'2012-10-17',Statement:[
   {Effect:'Allow',Action:['dynamodb:GetItem','dynamodb:PutItem','dynamodb:BatchWriteItem','dynamodb:BatchGetItem'],Resource:{'Fn::GetAtt':['Data','Arn']}},
   {Effect:'Allow',Action:['s3:GetObject'],Resource:[{'Fn::Sub':'${Media.Arn}/migration/*'},{'Fn::Sub':'${Media.Arn}/objects/*'}]},
   {Effect:'Allow',Action:['s3:PutObject'],Resource:{'Fn::Sub':'${Media.Arn}/entities/*'}},
   {Effect:'Allow',Action:['secretsmanager:PutSecretValue'],Resource:{Ref:'ProviderSecret'}},
   {Effect:'Allow',Action:['cognito-idp:AdminCreateUser','cognito-idp:AdminGetUser','cognito-idp:AdminSetUserPassword','cognito-idp:CreateIdentityProvider','cognito-idp:UpdateIdentityProvider','cognito-idp:AdminLinkProviderForUser'],Resource:{'Fn::GetAtt':['Users','Arn']}},
   {Effect:'Allow',Action:['logs:CreateLogStream','logs:PutLogEvents'],Resource:{'Fn::Sub':'arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/lambda/${AWS::StackName}-import:log-stream:*'}}
  ]}}]}},
  ImportFunction:{Type:'AWS::Lambda::Function',DependsOn:'ImportLogs',Properties:{FunctionName:{'Fn::Sub':'${AWS::StackName}-import'},Runtime:'nodejs22.x',Architectures:['arm64'],MemorySize:256,Timeout:900,ReservedConcurrentExecutions:1,Handler:'import.handler',Role:{'Fn::GetAtt':['ImportRole','Arn']},Code:'import.zip',Environment:{Variables:{DATA_TABLE:{Ref:'Data'},MEDIA_BUCKET:{Ref:'Media'},USER_POOL:{Ref:'Users'},PROVIDER_SECRET:{Ref:'ProviderSecret'},AUTH_DOMAIN:{'Fn::Sub':'https://${Domain}.auth.${AWS::Region}.amazoncognito.com'},SOURCE_PROJECT:'cbgcugshwivxpaurzyqq'}}}}
 };
 resources.AuthLogs={Type:'AWS::Logs::LogGroup',Properties:{LogGroupName:{'Fn::Sub':'/aws/lambda/${AWS::StackName}-auth'},RetentionInDays:7}};
 resources.AuthRole={Type:'AWS::IAM::Role',Properties:{AssumeRolePolicyDocument:{Version:'2012-10-17',Statement:[{Effect:'Allow',Principal:{Service:'lambda.amazonaws.com'},Action:'sts:AssumeRole'}]},Policies:[{PolicyName:'CognitoIdentityMapping',PolicyDocument:{Version:'2012-10-17',Statement:[
  {Effect:'Allow',Action:['cognito-idp:ListUsers'],Resource:{'Fn::GetAtt':['Users','Arn']}},
  {Effect:'Allow',Action:['dynamodb:GetItem','dynamodb:PutItem'],Resource:{'Fn::GetAtt':['Data','Arn']},Condition:{'ForAllValues:StringLike':{'dynamodb:LeadingKeys':['IDENTITY#*']},Null:{'dynamodb:LeadingKeys':false}}},
  {Effect:'Allow',Action:['logs:CreateLogStream','logs:PutLogEvents'],Resource:{'Fn::Sub':'arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/lambda/${AWS::StackName}-auth:log-stream:*'}}
 ]}}]}};
 resources.AuthFunction={Type:'AWS::Lambda::Function',DependsOn:'AuthLogs',Properties:{FunctionName:{'Fn::Sub':'${AWS::StackName}-auth'},Runtime:'nodejs22.x',Architectures:['arm64'],MemorySize:256,Timeout:15,ReservedConcurrentExecutions:2,Handler:'auth.handler',Role:{'Fn::GetAtt':['AuthRole','Arn']},Code:'auth.zip',Environment:{Variables:{DATA_TABLE:{Ref:'Data'},USER_POOL:{Ref:'Users'},APP_CLIENT:{Ref:'Client'},AUTH_DOMAIN:{'Fn::Sub':'https://${Domain}.auth.${AWS::Region}.amazoncognito.com'}}}}};
 resources.AuthIntegration={Type:'AWS::ApiGatewayV2::Integration',Properties:{ApiId:{Ref:'Api'},IntegrationType:'AWS_PROXY',IntegrationUri:{'Fn::GetAtt':['AuthFunction','Arn']},PayloadFormatVersion:'2.0',TimeoutInMillis:15000}};
 resources.AuthRoute={Type:'AWS::ApiGatewayV2::Route',Properties:{ApiId:{Ref:'Api'},RouteKey:'ANY /auth/v1/{proxy+}',Target:{'Fn::Sub':'integrations/${AuthIntegration}'}}};
 resources.AuthPermission={Type:'AWS::Lambda::Permission',Properties:{FunctionName:{Ref:'AuthFunction'},Action:'lambda:InvokeFunction',Principal:'apigateway.amazonaws.com',SourceAccount:{Ref:'AWS::AccountId'},SourceArn:{'Fn::Sub':'arn:${AWS::Partition}:execute-api:${AWS::Region}:${AWS::AccountId}:${Api}/*'}}};
 for(const [id,path] of [['SignedMediaRoute','/storage/v1/object/sign/{proxy+}'],['PublicMediaRoute','/storage/v1/object/public/recipe-catalog/{proxy+}']])resources[id]={Type:'AWS::ApiGatewayV2::Route',Properties:{ApiId:{Ref:'Api'},RouteKey:'GET '+path,Target:{'Fn::Sub':'integrations/${Integration}'}}};
 Object.assign(resources,aiResources(),voiceResources());
 resources.PublicRoute={Type:'AWS::ApiGatewayV2::Route',Properties:{ApiId:{Ref:'Api'},RouteKey:'ANY /public/{proxy+}',Target:{'Fn::Sub':'integrations/${Integration}'}}};
 resources.AIFunction.Properties.Environment.Variables.API_URL={'Fn::GetAtt':['Api','ApiEndpoint']};resources.AIRole.Properties.Policies[0].PolicyDocument.Statement.push({Effect:'Allow',Action:['s3:GetObject'],Resource:[{'Fn::Sub':'${Media.Arn}/objects/recipe-images/*'},{'Fn::Sub':'${Media.Arn}/objects/recipe-catalog/*'}]});resources.WorkerFunction.Properties.Environment.Variables.API_URL={'Fn::GetAtt':['Api','ApiEndpoint']};resources.WorkerFunction.Properties.Environment.Variables.AI_QUEUE={Ref:'AIQueue'};resources.WorkerRole.Properties.Policies[0].PolicyDocument.Statement.push({Effect:'Allow',Action:['sqs:SendMessage'],Resource:{'Fn::GetAtt':['AIQueue','Arn']}});resources.WorkerRole.Properties.Policies[0].PolicyDocument.Statement.push({Effect:'Allow',Action:['dynamodb:UpdateItem'],Resource:{'Fn::GetAtt':['Data','Arn']},Condition:{'ForAllValues:StringLike':{'dynamodb:LeadingKeys':['AI#*']},Null:{'dynamodb:LeadingKeys':false}}});
 resources.WorkerFunction.Properties.Environment.Variables.VOICE_MONITOR={Ref:'VoiceFunction'};
 resources.WorkerRole.Properties.Policies[0].PolicyDocument.Statement.push({Effect:'Allow',Action:['lambda:InvokeFunction'],Resource:{'Fn::GetAtt':['VoiceFunction','Arn']}});
 // A separate static frontend may be configured without replacing existing clients.
 for(const id of ['ApiFunction','AIFunction','AuthFunction'])resources[id].Properties.Environment.Variables.FRONTEND_ORIGIN={Ref:'FrontendOrigin'};
 const frontendOrigin={'Fn::If':['HasFrontendOrigin',{Ref:'FrontendOrigin'},{Ref:'AWS::NoValue'}]},frontendCallback={'Fn::If':['HasFrontendOrigin',{'Fn::Join':['',[{Ref:'FrontendOrigin'},'/']]},{Ref:'AWS::NoValue'}]};
 resources.Media.Properties.CorsConfiguration.CorsRules[0].AllowedOrigins.push(frontendOrigin);
 resources.Client.Properties.CallbackURLs.push(frontendCallback);resources.Client.Properties.LogoutURLs.push(frontendCallback);
 for(const [id,r] of Object.entries(resources))r.Metadata={'com.aws.cloudformation.Context':{why:id==='Data'?'Preserve immutable source snapshots and tenant-scoped application projections':id==='Media'?'Persist migrated recipe, step and private chat images':id==='Users'?'Independent authentication with preserved application UUID mapping':'Provide the independently authenticated AWS application runtime',must:['No Supabase runtime dependency','Keep source data and existing clients intact','No NAT, provisioned concurrency or cross-region resources','Do not enable production writes before RPC parity and final delta']}};
 return {AWSTemplateFormatVersion:'2010-09-09',Conditions:{HasFrontendOrigin:{'Fn::Not':[{'Fn::Equals':[{Ref:'FrontendOrigin'},'']}]}},Parameters:{FrontendOrigin:{Type:'String',Default:'',AllowedPattern:'^$|https://[a-z0-9.-]+$'},ReadCap:{Type:'Number',Default:100,MinValue:1,MaxValue:100},WriteCap:{Type:'Number',Default:100,MinValue:1,MaxValue:100}},Description:'Morzsa independent AWS backend with DynamoDB, Cognito, S3 and queued AI',Metadata:{AWSToolsMetrics:{AWSAgentToolkit:'aws-cloudformation@3'}},Resources:resources,Outputs:{TableName:{Value:{Ref:'Data'}},BucketName:{Value:{Ref:'Media'}},UserPoolId:{Value:{Ref:'Users'}},ClientId:{Value:{Ref:'Client'}},ApiUrl:{Value:{'Fn::GetAtt':['Api','ApiEndpoint']}},FunctionName:{Value:{Ref:'ApiFunction'}},AuthDomain:{Value:{'Fn::Sub':'https://${Domain}.auth.${AWS::Region}.amazoncognito.com'}}}};
}

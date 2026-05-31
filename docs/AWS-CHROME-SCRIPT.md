# Claude Chrome script — AWS IAM for Remotion Lambda

Paste the block below into Claude Chrome. You can paste it all at once, or one PHASE
at a time (more reliable). Region is irrelevant here — IAM is global.

CRITICAL EXACT NAMES (do not improvise):
- Role MUST be named exactly:  remotion-lambda-role
- Policies:  remotion-lambda-policy  and  remotion-user-policy
- The secret access key is shown ONCE — download the .csv.

---

You are setting up AWS IAM for a video render tool. Work carefully and confirm each
step before moving on. I am logged into the AWS Console. Do NOT change account
settings, billing, or regions. If any screen differs from these instructions, stop
and describe what you see instead of guessing.

PHASE 1 — Create the execution-role policy
1. Go to https://console.aws.amazon.com/iam/home#/policies
2. Click "Create policy".
3. Select the "JSON" tab. Clear the editor and paste EXACTLY this:
{
  "Version": "2012-10-17",
  "Statement": [
    { "Sid": "0", "Effect": "Allow", "Action": ["s3:ListAllMyBuckets"], "Resource": ["*"] },
    { "Sid": "1", "Effect": "Allow", "Action": ["s3:CreateBucket","s3:ListBucket","s3:PutBucketAcl","s3:GetObject","s3:DeleteObject","s3:PutObjectAcl","s3:PutObject","s3:GetBucketLocation"], "Resource": ["arn:aws:s3:::remotionlambda-*"] },
    { "Sid": "2", "Effect": "Allow", "Action": ["lambda:InvokeFunction"], "Resource": ["arn:aws:lambda:*:*:function:remotion-render-*"] },
    { "Sid": "3", "Effect": "Allow", "Action": ["logs:CreateLogGroup"], "Resource": ["arn:aws:logs:*:*:log-group:/aws/lambda-insights"] },
    { "Sid": "4", "Effect": "Allow", "Action": ["logs:CreateLogStream","logs:PutLogEvents"], "Resource": ["arn:aws:logs:*:*:log-group:/aws/lambda/remotion-render-*","arn:aws:logs:*:*:log-group:/aws/lambda-insights:*"] }
  ]
}
4. Click "Next". For Policy name enter exactly: remotion-lambda-policy
5. Click "Create policy". Confirm it appears in the policy list, then continue.

PHASE 2 — Create the deployer-user policy
1. Policies → "Create policy" → "JSON" tab. Clear and paste EXACTLY this:
{
  "Version": "2012-10-17",
  "Statement": [
    { "Sid": "HandleQuotas", "Effect": "Allow", "Action": ["servicequotas:GetServiceQuota","servicequotas:GetAWSDefaultServiceQuota","servicequotas:RequestServiceQuotaIncrease","servicequotas:ListRequestedServiceQuotaChangeHistoryByQuota"], "Resource": ["*"] },
    { "Sid": "PermissionValidation", "Effect": "Allow", "Action": ["iam:SimulatePrincipalPolicy"], "Resource": ["*"] },
    { "Sid": "LambdaInvokation", "Effect": "Allow", "Action": ["iam:PassRole"], "Resource": ["arn:aws:iam::*:role/remotion-lambda-role"] },
    { "Sid": "Storage", "Effect": "Allow", "Action": ["s3:GetObject","s3:DeleteObject","s3:PutObjectAcl","s3:PutObject","s3:CreateBucket","s3:ListBucket","s3:GetBucketLocation","s3:PutBucketAcl","s3:DeleteBucket","s3:PutBucketOwnershipControls","s3:PutBucketPublicAccessBlock","s3:PutBucketPolicy","s3:PutLifecycleConfiguration"], "Resource": ["arn:aws:s3:::remotionlambda-*"] },
    { "Sid": "BucketListing", "Effect": "Allow", "Action": ["s3:ListAllMyBuckets"], "Resource": ["*"] },
    { "Sid": "FunctionListing", "Effect": "Allow", "Action": ["lambda:ListFunctions","lambda:GetFunction"], "Resource": ["*"] },
    { "Sid": "FunctionManagement", "Effect": "Allow", "Action": ["lambda:InvokeAsync","lambda:InvokeFunction","lambda:CreateFunction","lambda:DeleteFunction","lambda:PutFunctionEventInvokeConfig","lambda:PutRuntimeManagementConfig","lambda:TagResource"], "Resource": ["arn:aws:lambda:*:*:function:remotion-render-*"] },
    { "Sid": "LogsRetention", "Effect": "Allow", "Action": ["logs:CreateLogGroup","logs:PutRetentionPolicy"], "Resource": ["arn:aws:logs:*:*:log-group:/aws/lambda/remotion-render-*"] },
    { "Sid": "FetchBinaries", "Effect": "Allow", "Action": ["lambda:GetLayerVersion"], "Resource": ["arn:aws:lambda:*:678892195805:layer:remotion-binaries-*","arn:aws:lambda:*:580247275435:layer:LambdaInsightsExtension*"] }
  ]
}
2. "Next" → Policy name exactly: remotion-user-policy → "Create policy". Confirm it lists.

PHASE 3 — Create the execution role
1. Go to https://console.aws.amazon.com/iam/home#/roles → "Create role".
2. Trusted entity type: "AWS service". Use case / Service: choose "Lambda". Click "Next".
3. On "Add permissions", search for: remotion-lambda-policy — tick its checkbox. Click "Next".
4. Role name — enter EXACTLY (no prefix/suffix): remotion-lambda-role
5. Click "Create role". Open the role afterward and confirm:
   - it has the policy "remotion-lambda-policy" attached, and
   - its Trust relationships show Service: lambda.amazonaws.com.

PHASE 4 — Create the deployer user
1. Go to https://console.aws.amazon.com/iam/home#/users → "Create user".
2. User name: remotion-deployer
3. Do NOT check "Provide user access to the AWS Management Console". Click "Next".
4. Permissions options: choose "Attach policies directly".
5. Search for: remotion-user-policy — tick its checkbox. Click "Next" → "Create user".

PHASE 5 — Create access keys (handle the secret carefully)
1. Open the user "remotion-deployer" → "Security credentials" tab.
2. Under "Access keys" click "Create access key".
3. Use case: select "Command Line Interface (CLI)" (or "Application running outside AWS").
   Check the confirmation/acknowledgement box. Click "Next" → "Create access key".
4. On the final screen click "Download .csv file" so the keys are saved locally.
5. Report back to me ONLY the "Access key ID" (it starts with AKIA...).
   For security, do NOT paste the "Secret access key" into chat — it is in the .csv.

When done, report: the Access key ID, and confirm the .csv was downloaded, and confirm
the role is named exactly remotion-lambda-role.

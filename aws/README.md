# API Vendor AWS Deployment

This folder contains only the active AWS deployment path for the current `api-vendor` backend.

## Current Setup

The application is already running on:

- Existing EC2 backend: `api-backend`
- Existing RDS PostgreSQL: `api-vendor-postgres`
- Existing VPC: `vpc-03cd1ed7d67d6be13`

The active CloudFormation template adds:

- Application Load Balancer on port `80`
- Target group for the existing EC2 backend on port `8000`
- Security group rule allowing ALB traffic to the backend
- Launch Template for future Auto Scaling instances
- Auto Scaling Group scaffold with desired capacity `0`

## Active Template

```text
aws/cloudformation/api-backend-existing-ec2-alb-asg.yml
```

## Deploy Or Update

Change the parameter values when reusing this template for another application.

```powershell
aws cloudformation deploy `
  --region ap-south-1 `
  --stack-name api-backend-alb-asg `
  --template-file aws/cloudformation/api-backend-existing-ec2-alb-asg.yml `
  --parameter-overrides `
    VpcId="vpc-03cd1ed7d67d6be13" `
    PublicSubnetIds="subnet-0a285c05b91c98af6,subnet-0423a9e1a19b1b60f,subnet-0b774d5f713d3c036" `
    ExistingInstanceId="i-02aea8d10ba2b508b" `
    ExistingInstanceSecurityGroupId="sg-0afae714fc80d44d9" `
    AppPort="8000" `
    HealthCheckPath="/" `
    AutoScalingImageId="ami-01b40e1bcccae197a" `
    AutoScalingDesiredCapacity="0" `
    AutoScalingMinSize="0" `
    AutoScalingMaxSize="1"
```

## Outputs

```powershell
aws cloudformation describe-stacks `
  --region ap-south-1 `
  --stack-name api-backend-alb-asg `
  --query "Stacks[0].Outputs"
```

Current Load Balancer URL:

```text
http://api-ba-Appli-3rQ8Rx47DyPA-902428055.ap-south-1.elb.amazonaws.com
```

## GitHub Actions Auto Deploy

The workflow lives at:

```text
.github/workflows/deploy-backend.yml
```

It deploys automatically when `main` changes under:

- `api-backend-fixed/**`
- `aws/**`
- `.github/workflows/deploy-backend.yml`

Add these secrets in GitHub repository settings before relying on auto deploy:

- `EC2_HOST`: public IP or DNS for the `api-backend` EC2 instance
- `EC2_USER`: SSH user, usually `ec2-user` for Amazon Linux or `ubuntu` for Ubuntu
- `EC2_SSH_KEY`: private SSH key that can connect to the EC2 instance
- `EC2_APP_DIR`: absolute path to this repo on EC2, for example `/home/ec2-user/API_Vendor_Application`
- `EC2_SSH_PORT`: optional, defaults to `22`
- `EC2_ENV_FILE`: optional, defaults to `api-backend-fixed/.env`
- `DEPLOY_COMMAND`: optional custom command to run on EC2 instead of the default Docker build/run

The EC2 server must already have Git and Docker installed. The backend `.env` must stay on the EC2 server and must not be committed to GitHub.

## Reuse Notes

When reusing this template for another backend, update:

- `ProjectName`
- `VpcId`
- `PublicSubnetIds`
- `ExistingInstanceId`
- `ExistingInstanceSecurityGroupId`
- `AppPort`
- `HealthCheckPath`
- `AutoScalingImageId`

Auto Scaling cannot directly manage an already-created EC2 instance. This template registers the existing EC2 in the target group and creates an Auto Scaling Group with desired capacity `0`. For full Auto Scaling, create an AMI from the configured backend EC2, update `AutoScalingImageId`, set desired/min capacity to `1`, verify the new instance is healthy, then remove the old manually-created EC2 from the target group.

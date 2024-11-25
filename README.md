## demo-iot-automotive-embeddedlinux-image

This repository wiil create the embedded-linux image, which is used by the [AWS IoT Automotive Cloud](https://github.com/aws4embeddedlinux/demo-iot-automotive-cloud) demo.

## TODO

- Address the AWS CodeCommit deprecation 
  - use connection ot a GitHub/GitLab?
  - host a self-managed GitLab?

### Prerequisites 

This is the list of pre requisites for completing the installation and deployment:

- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- [AWS CDK CLI](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html)
- [Node.js and NPM](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
- OS Packages 
  - Zip & Unzip

### Go to the CDK directory

```bash
cd cdk
```

### Prepare the CDK environment

```bash
# Install npm pakcages
npm install .

# Updating npm packages if you have an already have packages installed from before
# npm update

# Build the CDK stack
npm run build
```

### Setting environment variables

```bash
export AWS_PROFILE="default"
export AWS_DEFAULT_REGION=$(aws configure get region --profile ${AWS_PROFILE})
export AWS_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text --profile ${AWS_PROFILE})

echo "PROFILE : $AWS_PROFILE"
echo "ACCOUNT : $AWS_DEFAULT_ACCOUNT"
echo "REGION  : $AWS_DEFAULT_REGION"
```

### Bootstrap CDK

> [!NOTE]
> Only required once unless you upgrade your cdk version

```bash
cdk bootstrap
```

### Create the Claim certificates

```bash
export CERTIFICATE_PATH=claim-certs
mkdir -p $CERTIFICATE_PATH

export CERTIFICATE_ARN=$(aws iot create-keys-and-certificate \
    --certificate-pem-outfile "$CERTIFICATE_PATH/claim.cert.pem" \
    --public-key-outfile "$CERTIFICATE_PATH/claim.pubkey.pem" \
    --private-key-outfile "$CERTIFICATE_PATH/claim.pkey.pem" \
    --set-as-active \
    --query certificateArn --output text)

curl -o "$CERTIFICATE_PATH/claim.root.pem" https://www.amazontrust.com/repository/AmazonRootCA1.pem

mkdir -p $CERTIFICATE_PATH/$AWS_DEFAULT_ACCOUNT-$AWS_DEFAULT_REGION

echo $CERTIFICATE_ARN > $CERTIFICATE_PATH/$AWS_DEFAULT_ACCOUNT-$AWS_DEFAULT_REGION/certificate_arn.txt
cp -arf $CERTIFICATE_PATH/*.pem $CERTIFICATE_PATH/$AWS_DEFAULT_ACCOUNT-$AWS_DEFAULT_REGION/

export CERTIFICATE_ARN=$(more $CERTIFICATE_PATH/$AWS_DEFAULT_ACCOUNT-$AWS_DEFAULT_REGION/certificate_arn.txt)

echo "CERTIFICATE_ARN  : $CERTIFICATE_ARN"
```

### Deploy the CDK stack

> [!NOTE]
> The used [library](https://github.com/aws4embeddedlinux/aws4embeddedlinux-ci) is tested against Node Versions 16, 18, and 20. If these versions are not available for your system, we recommend
> using [NVM](https://github.com/nvm-sh/nvm) to install a compatible version

```bash
cdk deploy --all --require-approval never \
    --parameters biga-greengrass-fleet-provisoning:GGCertificateArnParam=$CERTIFICATE_ARN \
    -c certificateFilePath=$CERTIFICATE_PATH
```

The newly created pipeline `ubuntu_22_04BuildImagePipeline` from the CodePipeline console will start automatically.

After the pipeline completes, the **`EmbeddedLinux`** pipelines in the CodePipeline console page are ready to run.

But first create the claim certificates that should be bult-in to the device.

### Seed the CodeCommit repository

The other necessary params are part of the aws-biga-image.bb recipe

#### Create site.conf

```bash
echo -e "" > repo_seed/site.conf

echo -e GGV2_REGION=\"$(aws configure get region --profile ${AWS_PROFILE})\" >> repo_seed/site.conf

echo -e GGV2_DATA_EP=\"$(aws --output text iot describe-endpoint --profile ${AWS_PROFILE} --endpoint-type iot:Data-ATS           --query 'endpointAddress')\" >> repo_seed/site.conf
echo -e GGV2_CRED_EP=\"$(aws --output text iot describe-endpoint --profile ${AWS_PROFILE} --endpoint-type iot:CredentialProvider --query 'endpointAddress')\" >> repo_seed/site.conf

echo -e GGV2_TES_RALIAS=\"$(aws cloudformation describe-stacks   --profile ${AWS_PROFILE} --stack-name biga-greengrass-fleet-provisoning --query 'Stacks[0].Outputs[?OutputKey==`GGTokenExchangeRoleAlias`].OutputValue' --output text)\" >> repo_seed/site.conf

more repo_seed/site.conf
```

#### Upload site conf / manifest / buildspec

```bash
aws codecommit put-file \
    --repository-name ec2-ami-biga-layer-repo \
    --branch-name main \
    --file-content file://repo_seed/site.conf \
    --file-path /site.conf \
    --parent-commit-id $(aws codecommit get-branch --repository-name ec2-ami-biga-layer-repo --branch-name main --query 'branch.commitId' --output text) \
    --commit-message "commit site.conf" \
    --cli-binary-format raw-in-base64-out

aws codecommit put-file \
    --repository-name nxp-goldbox-biga-layer-repo \
    --branch-name main \
    --file-content file://repo_seed/site.conf \
    --file-path /site.conf \
    --parent-commit-id $(aws codecommit get-branch --repository-name nxp-goldbox-biga-layer-repo --branch-name main --query 'branch.commitId' --output text) \
    --commit-message "commit site.conf" \
    --cli-binary-format raw-in-base64-out
    
aws codecommit put-file \
    --repository-name ec2-ami-biga-layer-repo \
    --branch-name main \
    --file-content file://../manifest.xml \
    --file-path /manifest.xml \
    --parent-commit-id $(aws codecommit get-branch --repository-name ec2-ami-biga-layer-repo --branch-name main --query 'branch.commitId' --output text) \
    --commit-message "commit manifest.xml" \
    --cli-binary-format raw-in-base64-out

aws codecommit put-file \
    --repository-name nxp-goldbox-biga-layer-repo \
    --branch-name main \
    --file-content file://../manifest.xml \
    --file-path /manifest.xml \
    --parent-commit-id $(aws codecommit get-branch --repository-name nxp-goldbox-biga-layer-repo --branch-name main --query 'branch.commitId' --output text) \
    --commit-message "commit manifest.xml" \
    --cli-binary-format raw-in-base64-out
    
aws codecommit put-file \
    --repository-name ec2-ami-biga-layer-repo \
    --branch-name main \
    --file-content file://repo_seed/ami/build.buildspec.yml \
    --file-path /build.buildspec.yml \
    --parent-commit-id $(aws codecommit get-branch --repository-name ec2-ami-biga-layer-repo --branch-name main --query 'branch.commitId' --output text) \
    --commit-message "commit buildspec" \
    --cli-binary-format raw-in-base64-out

aws codecommit put-file \
    --repository-name nxp-goldbox-biga-layer-repo \
    --branch-name main \
    --file-content file://repo_seed/device/build.buildspec.yml \
    --file-path /build.buildspec.yml \
    --parent-commit-id $(aws codecommit get-branch --repository-name nxp-goldbox-biga-layer-repo --branch-name main --query 'branch.commitId' --output text) \
    --commit-message "commit buildspec" \
    --cli-binary-format raw-in-base64-out
```

## NXP Goldbox 

### Creating a flash the Device

In case of flashing the NXP GoldBox, once the **biga-build-nxp-goldbox-** pipeline is completed, you can simply go to the Artifacts S3 bucket and download the `sdcard` image. 

Alternatively, you can run the following commands:

```sh
ami_s3_bucket_arn=$(aws cloudformation describe-stacks --profile ${AWS_PROFILE} --stack-name biga-build-nxp-goldbox --output text --query "Stacks[0].Outputs[?OutputKey=='BuildOutput'].OutputValue")
ami_s3_bucket_name=${ami_s3_bucket_arn##*:}
echo $ami_s3_bucket_name

aws s3 cp s3://${ami_s3_bucket_name}/aws-biga-image-s32g274ardb2.sdcard .
```

Once the download is complete, insert the SDCard into the computer.

If you are a Windows user, you can use [Rufus]() to create you SD Card.

If you are a Linux/Mac user, proceed with the next steps.

To identify the device name of the SD card you can execute:

```
# Linux
lsblk
# Mac
diskutil list
```

And to unmount:

```
# Linux
sudo umount /dev/sdX1
# Mac
diskutil unmount /dev/diskXs1
```

Make sure to replace the `X` with the right block device or drive letter.

Now we can flash the device:

> Please note that it is important to specify the right block device here, otherwise this can erase all of your data, so be careful.

```sh
# Linux & Mac
sudo dd if=./aws-biga-image-s32g274ardb2.sdcard of=/dev/diskX bs=1m && sync
```

### Connect to the NXP Goldbox

Once completed, insert back the SD card into the GoldBox and reboot or power cycle the device. This will boot the device and we should be able to `ssh` into it if the host is in the same network:


```sh
ssh root@s32g274ardb2.local
```

# Troubleshooting 

## EC2 Graviton AMI // debugging

 Those steps are just necessary for debugging, or manually starting an EC2.

 In a scenario where we use an EC2 instance, we should be able to find the latest AMI that was created by the pipeline by doing:


```
export AWS_DEFAULT_REGION=$(aws configure get region)

aws ec2 describe-images \
    --region $AWS_DEFAULT_REGION \
    --owners self \
    --query 'Images | sort_by(@, &CreationDate) | [-1]' \
    --output json
```

This command sorts AMI images and provides us with the latest entry. From here, we should grab the latest `ImageId`. Please note that the description should look something like this:

```
 "Description": "DISTRO=poky;DISTRO_CODENAME=quillback;DISTRO_NAME=Automotive Grade Linux;DISTRO_VERSION=16.91.0...
```

Second, we will need a key pair:

```
aws ec2 create-key-pair --key-name biga --query 'KeyMaterial' --output text > biga.pem
chmod 400 biga.pem
```


Third, we need a security group (to allow ssh access later on)

```
aws ec2 create-security-group --group-name bigaSG --description "a default sg for biga"
aws ec2 authorize-security-group-ingress --group-id <security_group_id>  --protocol tcp  --port 22  --cidr 0.0.0.0/0
```
If you already created it, you can find the security_group_id this way:
```
aws ec2 describe-security-groups     --filters Name=group-name,Values=*biga*      --query "SecurityGroups[*].{Name:GroupName,ID:GroupId}"

```

And finally, we can launch the Graviton instance:

```
aws ec2 run-instances --image-id <ImageId> --instance-type t4g.micro --key-name biga --security-group-ids <security_group_id> --count 1
```

This will output the `InstanceId`, which we can use to get the public IP:

```
aws ec2 describe-instances --instance-ids <InstanceId> --query 'Reservations[0].Instances[0].PublicIpAddress' --output text
```

Which we will need to `ssh` to the target:

```
ssh -i biga.pem user@<public IP>
```


### Testing the Device

Now we can start deploying the Greengrass components to the target.

# Cleanup

### Destroy cloud resources:

```bash
cdk destroy --all --force
```

# Appendix

## Useful CDK commands

-   `npm run build` compile typescript to js
-   `npm run watch` watch for changes and compile
-   `npm run test` perform the jest unit tests
-   `cdk deploy` deploy this stack to your default AWS account/region
-   `cdk diff` compare deployed stack with current state
-   `cdk synth` emits the synthesized CloudFormation template

Project Specific:
-   `npm run format` runs prettier and eslint on the repository
-   `npm run zip-data` bundles the files for creating build host containers
-   `npm run check` checks for lint and format issues
-   `npm run docs` to generate documentation


## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.

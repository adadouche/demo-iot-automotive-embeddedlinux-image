## demo-iot-automotive-embeddedlinux-image

This repo is to create a embedded-linux image, which is part of https://github.com/aws4embeddedlinux/demo-iot-automotive-cloud

# Meta-AWS CDK Library

An AWS [Cloud Developer Toolkit](https://docs.aws.amazon.com/cdk/v2/guide/home.html) Library for building Yocto projects in AWS.

## Quickstart
to create yocto demo build pipelines and cloud resources.

change into cdk dir - all following steps from the README are performed there.
```bash
cd cdk
```
### Setting Up

##### Create claim certificate

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
```

#### install npm packages:

```bash
npm install .
```

#### updating - if you have an already have packages installed before
```bash
npm update
```

#### build:

```bash
npm run build
```

#### deploy cloud resources for all demo pipelines:

> [!NOTE]
> The used [library](https://github.com/aws4embeddedlinux/aws4embeddedlinux-ci) is tested against Node Versions 16, 18, and 20. If these versions are not available for your system, we recommend
> using [NVM](https://github.com/nvm-sh/nvm) to install a compatible version

```bash
# only required once
cdk bootstrap

cdk deploy --all --require-approval never \
    --parameters PokyStack:GGCertificateArnParam=$CERTIFICATE_ARN \
    -c certificateFilePath=$CERTIFICATE_PATH
```

The newly created pipeline `ubuntu_22_04BuildImagePipeline` from the CodePipeline console will start automatically.

After that completes, the EmbeddedLinux pipeline in the CodePipeline console page is ready to run.
But first create the claim certificates that should be bultin to the device.

#### seed repo with site.conf:
The other necessary params are part of the aws-biga-image.bb recipe

##### create site.conf:

```bash
echo -e "" > repo_seed/site.conf

echo -e GGV2_REGION=\"$(aws configure get region)\" >> repo_seed/site.conf

echo -e GGV2_DATA_EP=\"$(aws --output text iot describe-endpoint \
    --endpoint-type iot:Data-ATS \
    --query 'endpointAddress')\" >> repo_seed/site.conf

echo -e GGV2_CRED_EP=\"$(aws --output text iot describe-endpoint \
    --endpoint-type iot:CredentialProvider \
    --query 'endpointAddress')\" >> repo_seed/site.conf

echo -e GGV2_TES_RALIAS=\"$(aws cloudformation describe-stacks --stack-name GGFleetProvisoning \
 --query 'Stacks[0].Outputs[?OutputKey==`GGTokenExchangeRoleAlias`].OutputValue' --output text)\" >> repo_seed/site.conf
```

##### upload site.conf

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
```

##### upload manifest.xml

```bash
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
```


#### seed repo with biga buildspec:
```bash
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

# Flashing the Device

## NXP Goldbox

In case of flashing the NXP GoldBox, once the pipeline is completed, we can simply go to the Artifacts S3 bucket and download the `sdcard` image. Once the download is complete, insert the SDCard into the computer and unmount any partitions in case they have been automounted.

To identify the device name of the SD card you can do:

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

Make sure to replace the `X` with the right block device.

Now we can flash the device:
> Please note that it is important to specify the right block device here, otherwise this can erase all of your data, so be careful.

```
sudo dd if=./aws-biga-image-s32g274ardb2.sdcard of=/dev/diskX bs=1m && sync
```

Once completed, insert back the SD card into the GoldBox and reboot or power cycle the device. This will boot the device and we should be able to `ssh` into it if the host is in the same network:

```
ssh root@s32g274ardb2.local
```

After the successful build, we can go ahead and bootstrap a device.
## EC2 Graviton AMI // debugging
 Those steps are just necessary for debugging, or manually starting an EC2.

 In a scenario where we use an EC2 instance, we should be able to find the latest AMI that was created by the pipeline by doing:


```
export AWS_REGION=$(aws configure get region)

aws ec2 describe-images \
    --region $AWS_REGION \
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

### Destroy cloud resources for all demo pipelines:
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

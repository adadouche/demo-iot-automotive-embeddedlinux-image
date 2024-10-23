#!/usr/bin/env node

import path = require('path');
import fs = require('fs')

import * as cdk from "aws-cdk-lib";
import { GreenGrassBootstrapStack } from '../lib/greengrass-bootstrap';
import {
  BuildImageDataStack,
  BuildImagePipelineStack,
  BuildImageRepoStack,
  EmbeddedLinuxPipelineStack,
  ImageKind,
  PipelineNetworkStack,
  ProjectKind,
} from "aws4embeddedlinux-cdk-lib";
import { CfnPolicy, CfnPolicyPrincipalAttachment, CfnThingGroup } from "aws-cdk-lib/aws-iot";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { CfnOutput, CfnParameter, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { StringParameter } from 'aws-cdk-lib/aws-ssm';


const app = new cdk.App();

/* See https://docs.aws.amazon.com/sdkref/latest/guide/access.html for details on how to access AWS. */
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || process.env.AWS_DEFAULT_REGION,
};

/**
 * Use these default props to enable termination protection and tag related AWS
 * Resources for tracking purposes.
 */
const defaultProps: cdk.StackProps = {
  tags: { PURPOSE: "META-AWS-BUILD" },
  env,
};


export interface PokyStackProps extends StackProps {
  GGProvisioningClaimPolicy: CfnPolicy
}

export class PokyStack extends Stack {
  constructor(scope: Construct, id: string, props: PokyStackProps) {
    super(scope, id, props);

    const ggCertificateArnParam = new CfnParameter(this, `GGCertificateArnParam`, {
      noEcho: true,
      description: 'Certificate ARN created using files generated locally',
      allowedPattern: 'arn:(aws[a-zA-Z0-9-]*):iot:([a-z]{2}(-gov)?-[a-z]+-\\d{1})?:(\\d{12})?:cert/(.*)',
                      //  arn:aws:iot:us-east-1:218239986631:cert/c9594919d882c53fa2231fd1c403eda7e70f409d2ad5c2d4dc5688b68372d69c
    });

    new CfnOutput(this, 'CertificateArn', {
      exportName: 'CertificateArn',
      description: 'Certificate Arn.',
      value: ggCertificateArnParam.valueAsString,
    });

    new CfnPolicyPrincipalAttachment(this, 'GGProvisioningClaimPolicyAttachment', {
      policyName: `${props.GGProvisioningClaimPolicy.policyName}`,
      principal: ggCertificateArnParam.valueAsString.replace('"', "")
    });

    const certificateFilePath = this.node.tryGetContext('certificateFilePath') || './claim-certs';

    new CfnThingGroup(this, 'GGThingGroup', {
      thingGroupName: "EmbeddedLinuxFleet",
    });

    const my_stacks = ['EC2AMIBigaPipeline', 'NxpGoldboxBigaPipeline']
    const my_cert_files = ['claim.cert.pem', 'claim.pkey.pem', 'claim.root.pem']
    for (var my_stack of my_stacks) {
      for (var my_cert_file of my_cert_files) {
        const my_id = `${my_stack}_${my_cert_file}`;
        const content: string = fs.readFileSync(
          path.resolve(certificateFilePath, `${my_cert_file}`),
          { encoding: 'utf8', flag: 'r' }
        );
        new StringParameter(this, `${my_id}`, {
          parameterName: `${my_id}`,
          stringValue: content,
        });
      }
    }
  }
}


/**
 * Set up networking to allow us to securely attach EFS to our CodeBuild instances.
 */
const vpc = new PipelineNetworkStack(app, {
  ...defaultProps,
  description: "AWS IoT Automotive Demo - VPC Network Stack",
});

/**
 * Set up the ECR repository to be used for storing container images.
 */
const buildImageRepo = new BuildImageRepoStack(app, "BuildImageRepo", {
  ...defaultProps,
  description: "AWS IoT Automotive Demo - Build Image Repo Stack",
});


/**
 * Set up the Stacks that Bootstrap Greengrass for the fleet provisioning.
 */
const greenGrassBootstrapStack = new GreenGrassBootstrapStack(app, 'GGFleetProvisoning', {
  env: env,
  description: "AWS IoT Automotive Demo - AWS GreenGrass Bootstrap Stack",
});

/**
 * Set up the Poky Stack that create the SSM Parameters, Thing Group and associate the certificate with it
 */
const pokyStack = new PokyStack(app, 'PokyStack', {
  GGProvisioningClaimPolicy: greenGrassBootstrapStack.getProvisioningClaimPolicy(),
  description: "AWS IoT Automotive Demo - Poky Base Stack",
})
pokyStack.addDependency(greenGrassBootstrapStack);

/**
 * Set up the Stacks that create our Build Host.
 */
const buildImageData = new BuildImageDataStack(app, "BuildImageData", {
  ...defaultProps,
  description: "AWS IoT Automotive Demo - Ubuntu Build Image Stack",
  bucketName: `build-image-data-${env.account}-${env.region}`,
});
buildImageData.addDependency(greenGrassBootstrapStack);


const buildImagePipelineStack = new BuildImagePipelineStack(app, "BuildImagePipeline", {
  ...defaultProps,
  description: "AWS IoT Automotive Demo - Build Image Pipeline Stack",
  dataBucket: buildImageData.bucket,
  repository: buildImageRepo.repository,
  imageKind: ImageKind.Ubuntu22_04,
});
buildImagePipelineStack.addDependency(greenGrassBootstrapStack);

/**
 * Create a biga pipeline for AMI.
 */
const ec2AMIBigaPipeline = new EmbeddedLinuxPipelineStack(app, "EC2AMIBigaPipeline", {
  ...defaultProps,
  description: "AWS IoT Automotive Demo - Biga EC2 AMI Image Pipeline Stack",
  imageRepo: buildImageRepo.repository,
  imageTag: ImageKind.Ubuntu22_04,
  vpc: vpc.vpc,
  buildPolicyAdditions: [
    PolicyStatement.fromJson({
      Effect: "Allow",
      Action: "ssm:GetParameter",
      Resource:
        `arn:aws:ssm:${env.region}:${env.account}:parameter/EC2AMIBigaPipeline*`,
    }),
  ],
  layerRepoName: "ec2-ami-biga-layer-repo",
  projectKind: ProjectKind.PokyAmi,
});
ec2AMIBigaPipeline.addDependency(pokyStack);

/**
 * Create a biga pipeline for agl-nxp-goldbox.
 */
const nxpGoldboxBigaPipeline = new EmbeddedLinuxPipelineStack(app, "NxpGoldboxBigaPipeline", {
  ...defaultProps,
  description: "AWS IoT Automotive Demo - Biga NXP GoleBox Image Pipeline Stack",
  imageRepo: buildImageRepo.repository,
  imageTag: ImageKind.Ubuntu22_04,
  vpc: vpc.vpc,
  buildPolicyAdditions: [
    PolicyStatement.fromJson({
      Effect: "Allow",
      Action: "ssm:GetParameter",
      Resource:
        `arn:aws:ssm:${env.region}:${env.account}:parameter/NxpGoldboxBigaPipeline*`,
    }),
  ],
  layerRepoName: "nxp-goldbox-biga-layer-repo",
  projectKind: ProjectKind.MetaAwsDemo,
});
nxpGoldboxBigaPipeline.addDependency(pokyStack);

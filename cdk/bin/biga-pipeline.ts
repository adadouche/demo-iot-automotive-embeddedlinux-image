#!/usr/bin/env node
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
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { BigaBaseStack } from "../lib/biga-base";

declare const tags: any;

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
  // env:env,
};

/**
 * Set up the Certificate Stack that create the SSM Parameters, Thing Group and associate the certificate with it
 */
const bigaBaseStack = new BigaBaseStack(app, 'biga-base', {
  ...defaultProps,
  description: "AWS IoT Automotive Demo - Biga Base Stack",
})


/**
 * Set up networking to allow us to securely attach EFS to our CodeBuild instances.
 */
const vpc = new PipelineNetworkStack(app, "biga-build-vpc", {
  ...defaultProps,
  description: "AWS IoT Automotive Demo - VPC Network Stack",
});

/**
 * Set up the ECR repository to be used for storing container images.
 */
const buildImageRepo = new BuildImageRepoStack(app, "biga-build-repo", {
  ...defaultProps,
  description: "AWS IoT Automotive Demo - Build Image Repo Stack",
});


/**
 * Set up the Stacks that Bootstrap Greengrass for the fleet provisioning.
 */
const greenGrassBootstrapStack = new GreenGrassBootstrapStack(app, 'biga-greengrass-fleet-provisoning', {
  ...defaultProps,
  description: "AWS IoT Automotive Demo - AWS IoT GreenGrass Bootstrap Stack",
});
greenGrassBootstrapStack.addDependency(bigaBaseStack);


/**
 * Set up the Stacks that create our Build Host.
 */
const buildImageData = new BuildImageDataStack(app, "biga-build-data", {
  ...defaultProps,
  description: "AWS IoT Automotive Demo - Base Ubuntu Build Image for pipeline execution",
  bucketName: `build-image-data-${env.account}-${env.region}`,
});
buildImageData.addDependency(greenGrassBootstrapStack);


const buildImagePipelineStack = new BuildImagePipelineStack(app, "biga-build-image", {
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
const ec2AMIBigaPipeline = new EmbeddedLinuxPipelineStack(app, "biga-build-ec2-ami", {
  ...defaultProps,
  description: "AWS IoT Automotive Demo - Biga Image Pipeline for EC2 AMI Stack",
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
ec2AMIBigaPipeline.addDependency(bigaBaseStack);

/**
 * Create a biga pipeline for agl-nxp-goldbox.
 */
const nxpGoldboxBigaPipeline = new EmbeddedLinuxPipelineStack(app, "biga-build-nxp-goldbox", {
  ...defaultProps,
  description: "AWS IoT Automotive Demo - Biga Image Pipeline for NXP GoleBox Stack",
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
nxpGoldboxBigaPipeline.addDependency(bigaBaseStack);

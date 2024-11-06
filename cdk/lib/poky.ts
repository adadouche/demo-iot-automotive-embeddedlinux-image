import fs = require('fs')
import path = require('path');
import { Construct } from 'constructs';
import {
    CfnOutput,
    CfnParameter,
    Stack,
    StackProps
} from 'aws-cdk-lib';
import {
    CfnPolicy,
    CfnPolicyPrincipalAttachment,
    CfnThingGroup
} from "aws-cdk-lib/aws-iot";
import { StringParameter } from 'aws-cdk-lib/aws-ssm';

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

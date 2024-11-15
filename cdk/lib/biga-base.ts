import fs = require('fs')
import path = require('path');
import { Construct } from 'constructs';
import {
    Stack,
    StackProps
} from 'aws-cdk-lib';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { CfnThingGroup } from 'aws-cdk-lib/aws-iot';

export class BigaBaseStack extends Stack {
    constructor(scope: Construct, id: string, props: StackProps) {
        super(scope, id, props);


        new CfnThingGroup(this, 'GGThingGroup', {
            thingGroupName: "EmbeddedLinuxFleet",
        });

        const certificateFilePath = this.node.tryGetContext('certificateFilePath') || './claim-certs';

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

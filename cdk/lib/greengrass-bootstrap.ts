
import { Construct } from 'constructs';
import {
    CfnOutput,
    Fn,
    Stack,
    StackProps
} from 'aws-cdk-lib';
import {
    Effect,
    PolicyDocument,
    PolicyStatement,
    Role,
    ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import {
    CfnPolicy,
    CfnRoleAlias,
    CfnProvisioningTemplate,
} from 'aws-cdk-lib/aws-iot';

export interface GreenGrassBootstrapStackProps extends StackProps {
    // List all the properties,
    env: {
        account: string | undefined,
        region: string | undefined,
    },
}

export class GreenGrassBootstrapStack extends Stack {
    private props: GreenGrassBootstrapStackProps;

    private ggProvisioningClaimPolicy: CfnPolicy;
    private ggTokenExchangeRole: Role;
    private ggFleetProvisioningRole: Role;
    private ggTokenExchangeRoleAlias: CfnRoleAlias;
    private ggDeviceDefaultPolicy: CfnPolicy;
    private ggFleetProvisionTemplate: CfnProvisioningTemplate;

    public getProvisioningClaimPolicy() {
        if (this.ggProvisioningClaimPolicy === undefined) {
            // const _uuid = this.stackId.replace('-', '').substring(this.stackId.length-8);
            // Fn.split('-', Fn.split('/', this.stackId)[2])[4];
            // arn:aws:cloudformation:us-east-1:218239986631:stack/GGFleetProvisoning/39df4fc0-8867-11ef-8771-0e3c18f7ab13
            this.ggProvisioningClaimPolicy = new CfnPolicy(this, 'GGProvisioningClaimPolicy', {
                policyName: `${this.stackName}_GGProvisioningClaimPolicy`,
                policyDocument: new PolicyDocument({
                    statements: [
                        new PolicyStatement({
                            effect: Effect.ALLOW,
                            actions: [
                                'iot:Connect'
                            ],
                            resources: ['*'],
                        }),
                        new PolicyStatement({
                            effect: Effect.ALLOW,
                            actions: [
                                'iot:Publish',
                                'iot:Receive',
                            ],
                            resources: [
                                `arn:aws:iot:${this.props.env.region}:${this.props.env.account}:topic/$aws/certificates/create/*`,
                                `arn:aws:iot:${this.props.env.region}:${this.props.env.account}:topic/$aws/provisioning-templates/${this.getFleetProvisionTemplate().templateName}/provision/*`
                            ],
                        }),
                        new PolicyStatement({
                            effect: Effect.ALLOW,
                            actions: [
                                'iot:Subscribe',
                            ],
                            resources: [
                                `arn:aws:iot:${this.props.env.region}:${this.props.env.account}:topicfilter/$aws/certificates/create/*`,
                                `arn:aws:iot:${this.props.env.region}:${this.props.env.account}:topicfilter/$aws/provisioning-templates/${this.getFleetProvisionTemplate().templateName}/provision/*`,
                            ],
                        })],
                })
            });
        }
        return this.ggProvisioningClaimPolicy;
    }

    public getTokenExchangeRole() {
        if (this.ggTokenExchangeRole === undefined) {
            this.ggTokenExchangeRole = new Role(this, `GGCredentialsRole`, {
                assumedBy: new ServicePrincipal('credentials.iot.amazonaws.com'),
                path: '/',
            });

            this.ggTokenExchangeRole.assumeRolePolicy?.addStatements(
                new PolicyStatement({
                    principals: [
                        new ServicePrincipal('credentials.iot.amazonaws.com')
                    ],
                    actions: [
                        'sts:AssumeRole'
                    ],
                    effect: Effect.ALLOW
                })
            );

            this.ggTokenExchangeRole.addToPolicy(
                new PolicyStatement({
                    sid: `GGTokenExchangeRoleNameAccess`,
                    effect: Effect.ALLOW,
                    resources: ['*'], // #TODO: - !Sub arn:aws:s3:::${S3BucketName} or !Sub arn:aws:s3:::${S3BucketName}/${S3BucketPrefixPattern}
                    actions: [
                        'iot:DescribeCertificate',
                        'logs:CreateLogGroup',
                        'logs:CreateLogStream',
                        'logs:PutLogEvents',
                        'logs:DescribeLogStreams',
                        's3:GetBucketLocation',
                        's3:GetObject',
                        's3:ListBucket',
                        's3:PutObject',
                        's3:PutObjectAcl'
                    ]
                })
            );
        }
        return this.ggTokenExchangeRole;

    }

    public getFleetProvisioningRole() {
        if (this.ggFleetProvisioningRole === undefined) {
            this.ggFleetProvisioningRole = new Role(this, `GGIoTRole`, {
                assumedBy: new ServicePrincipal('iot.amazonaws.com'),
                path: '/',
            });

            this.ggFleetProvisioningRole.assumeRolePolicy?.addStatements(
                new PolicyStatement({
                    principals: [
                        new ServicePrincipal('iot.amazonaws.com')
                    ],
                    actions: [
                        'sts:AssumeRole'
                    ],
                    effect: Effect.ALLOW
                })
            );

            this.ggFleetProvisioningRole.addManagedPolicy({
                managedPolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSIoTThingsRegistration'
            });

            this.ggFleetProvisioningRole.addToPolicy(
                new PolicyStatement({
                    sid: `GGTokenExchangeRoleNameAccess`,
                    effect: Effect.ALLOW,
                    resources: ['*'], // #TODO: - !Sub arn:aws:s3:::${S3BucketName} or !Sub arn:aws:s3:::${S3BucketName}/${S3BucketPrefixPattern}
                    actions: [
                        'iot:DescribeCertificate',
                        'logs:CreateLogGroup',
                        'logs:CreateLogStream',
                        'logs:PutLogEvents',
                        'logs:DescribeLogStreams',
                        's3:GetBucketLocation',
                        's3:GetObject',
                        's3:ListBucket',
                        's3:PutObject',
                        's3:PutObjectAcl'
                    ]
                })
            );
        }
        return this.ggFleetProvisioningRole;
    }

    public getTokenExchangeRoleAlias() {
        if (this.ggTokenExchangeRoleAlias === undefined) {
            this.ggTokenExchangeRoleAlias = new CfnRoleAlias(this, 'GGRoleAlias', {
                roleAlias: `${this.stackName}_GGRoleAlias`,
                roleArn: this.getTokenExchangeRole().roleArn,
            });
        }
        return this.ggTokenExchangeRoleAlias;
    }

    public getDeviceDefaultPolicy() {
        if (this.ggDeviceDefaultPolicy === undefined) {
            this.ggDeviceDefaultPolicy = new CfnPolicy(this, 'GGPolicy', {
                policyName: `${this.stackName}_DeviceDefaultPolicy`,
                policyDocument: new PolicyDocument({
                    statements: [
                        new PolicyStatement({
                            effect: Effect.ALLOW,
                            actions: [
                                'iot:Connect',
                                'iot:Publish',
                                'iot:Subscribe',
                                'iot:Receive',
                                'iot:Connect',
                                'greengrass:*',
                            ],
                            resources: ['*'],
                        }),
                        new PolicyStatement({
                            effect: Effect.ALLOW,
                            actions: [
                                'iot:AssumeRoleWithCertificate',
                            ],
                            resources: [this.getTokenExchangeRoleAlias().attrRoleAliasArn],
                        })],
                })
            });
        }
        return this.ggDeviceDefaultPolicy;
    }

    public getFleetProvisionTemplate() {
        if (this.ggFleetProvisionTemplate === undefined) {
            this.ggFleetProvisionTemplate = new CfnProvisioningTemplate(this, 'GGProvisioningTemplate', {
                templateName : `${this.stackName}_ProvisionTemplate`,
                description: 'Fleet Provisioning template for AWS IoT Greengrass.',
                enabled: true,
                provisioningRoleArn: this.getFleetProvisioningRole().roleArn,
                templateBody: `
                
                      {
                        "Parameters": {
                          "ThingName": {
                            "Type": "String"
                          },
                          "ThingGroupName": {
                            "Type": "String"
                          },
                          "AWS::IoT::Certificate::Id": {
                            "Type": "String"
                          }
                        },
                        "Resources": {
                          "GGThing": {
                            "OverrideSettings": {
                              "AttributePayload": "REPLACE",
                              "ThingGroups": "REPLACE",
                              "ThingTypeName": "REPLACE"
                            },
                            "Properties": {
                              "AttributePayload": {},
                              "ThingGroups": [
                                {
                                  "Ref": "ThingGroupName"
                                }
                              ],
                              "ThingName": {
                                "Ref": "ThingName"
                              }
                            },
                            "Type": "AWS::IoT::Thing"
                          },
                          "GGDefaultPolicy": {
                            "Properties": {
                              "PolicyName": "${this.getDeviceDefaultPolicy().policyName}"
                            },
                            "Type": "AWS::IoT::Policy"
                          },
                          "GGCertificate": {
                            "Properties": {
                              "CertificateId": {
                                "Ref": "AWS::IoT::Certificate::Id"
                              },
                              "Status": "Active"
                            },
                            "Type": "AWS::IoT::Certificate"
                          }
                        }
                      }
                `
            });
        }
        return this.ggFleetProvisionTemplate;
    }

    constructor(scope: Construct, id: string, props: GreenGrassBootstrapStackProps) {
        super(scope, id);
        this.props = props;

        this.getProvisioningClaimPolicy();
        this.getTokenExchangeRole();
        this.getFleetProvisioningRole();
        this.getTokenExchangeRoleAlias();
        this.getDeviceDefaultPolicy()
        this.getFleetProvisionTemplate();

        new CfnOutput(this, 'GGTokenExchangeRoleAlias', {
            exportName: 'GGTokenExchangeRoleAlias',
            description: 'Name of token exchange role alias.',
            value: `${this.getTokenExchangeRoleAlias().roleAlias}`,
        });

        new CfnOutput(this, 'GGClaimPolicy', {
            exportName: 'GGClaimPolicy',
            description: 'Name of claim policy.',
            value: `${this.getProvisioningClaimPolicy().policyName}`,
        });
    }
}

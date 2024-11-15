
import { Construct } from 'constructs';
import {
    CfnOutput,
    Stack,
    StackProps,
    Aws,
    CfnParameter,
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
    CfnPolicyPrincipalAttachment,
    CfnThingGroup,
} from 'aws-cdk-lib/aws-iot';

export class GreenGrassBootstrapStack extends Stack {
    private ggProvisioningClaimPolicy: CfnPolicy;
    private ggTokenExchangeRole: Role;
    private ggFleetProvisioningRole: Role;
    private ggTokenExchangeRoleAlias: CfnRoleAlias;
    private ggDeviceDefaultPolicy: CfnPolicy;
    private ggFleetProvisionTemplate: CfnProvisioningTemplate;
    private ggCertificateArnParam: CfnParameter;

    constructor(scope: Construct, id: string, props: StackProps) {
        super(scope, id, props);

        this.ggCertificateArnParam = new CfnParameter(this, `GGCertificateArnParam`, {
            noEcho: true,
            description: 'Certificate ARN created using files generated locally',
            allowedPattern: 'arn:(aws[a-zA-Z0-9-]*):iot:([a-z]{2}(-gov)?-[a-z]+-\\d{1})?:(\\d{12})?:cert/(.*)',
            //  arn:aws:iot:us-east-1:218239986631:cert/c9594919d882c53fa2231fd1c403eda7e70f409d2ad5c2d4dc5688b68372d69c
        });

        this.getGreengrassTokenExchangeRole();
        this.getGreengrassTokenExchangeRoleAlias();
        this.getGreengrassIoTThingPolicy()
        this.getGreengrassFleetProvisioningRole();
        this.getGreengrassFleetProvisioningTemplate();
        this.getGreengrassProvisioningClaimPolicy();

        new CfnOutput(this, 'GGTokenExchangeRoleAlias', {
            exportName: 'GGTokenExchangeRoleAlias',
            description: 'Name of token exchange role alias.',
            value: `${this.getGreengrassTokenExchangeRoleAlias().roleAlias}`,
        });

        new CfnOutput(this, 'GGClaimPolicy', {
            exportName: 'GGClaimPolicy',
            description: 'Name of claim policy.',
            value: `${this.getGreengrassProvisioningClaimPolicy().policyName}`,
        });

        new CfnOutput(this, 'CertificateArn', {
            exportName: 'CertificateArn',
            description: 'Certificate Arn.',
            value: this.ggCertificateArnParam.valueAsString,
        });
    }

    public getGreengrassTokenExchangeRole() {
        if (this.ggTokenExchangeRole === undefined) {
            this.ggTokenExchangeRole = new Role(this, `GGCredentialsRole`, {
                roleName: "GreengrassV2TokenExchangeRole",
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
                    sid: `GreengrassV2TokenExchangeRoleAccess`,
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

    public getGreengrassTokenExchangeRoleAlias() {
        if (this.ggTokenExchangeRoleAlias === undefined) {
            this.ggTokenExchangeRoleAlias = new CfnRoleAlias(this, 'GGRoleAlias', {
                roleAlias: `GreengrassCoreTokenExchangeRoleAlias`,
                roleArn: this.getGreengrassTokenExchangeRole().roleArn,
            });
        }
        return this.ggTokenExchangeRoleAlias;
    }

    public getGreengrassIoTThingPolicy() {
        if (this.ggDeviceDefaultPolicy === undefined) {
            this.ggDeviceDefaultPolicy = new CfnPolicy(this, 'GGPolicy', {
                policyName: `GreengrassIoTThingPolicy`,
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
                            resources: [this.getGreengrassTokenExchangeRoleAlias().attrRoleAliasArn],
                        })],
                })
            });
        }
        return this.ggDeviceDefaultPolicy;
    }

    public getGreengrassFleetProvisioningRole() {
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
                    sid: `GreengrassV2TokenExchangeRoleAccess`,
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

    public getGreengrassFleetProvisioningTemplate() {
        if (this.ggFleetProvisionTemplate === undefined) {
            this.ggFleetProvisionTemplate = new CfnProvisioningTemplate(this, 'GGProvisioningTemplate', {
                templateName: `GGProvisionTemplate`,
                description: 'Fleet Provisioning template for AWS IoT Greengrass.',
                enabled: true,
                provisioningRoleArn: this.getGreengrassFleetProvisioningRole().roleArn,
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
                          "MyGreengrassThing": {
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
                          "MyGreengrassPolicy": {
                            "Properties": {
                              "PolicyName": "${this.getGreengrassIoTThingPolicy().policyName}"
                            },
                            "Type": "AWS::IoT::Policy"
                          },
                          "MyGreengrassCertificate": {
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

    public getGreengrassProvisioningClaimPolicy() {
        if (this.ggProvisioningClaimPolicy === undefined) {
            // const _uuid = this.stackId.replace('-', '').substring(this.stackId.length-8);
            // Fn.split('-', Fn.split('/', this.stackId)[2])[4];
            // arn:aws:cloudformation:us-east-1:218239986631:stack/GGFleetProvisoning/39df4fc0-8867-11ef-8771-0e3c18f7ab13
            this.ggProvisioningClaimPolicy = new CfnPolicy(this, 'GGProvisioningClaimPolicy', {
                policyName: `GreengrassProvisioningClaimPolicy`,
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
                                `arn:aws:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topic/$aws/certificates/create/*`,
                                `arn:aws:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topic/$aws/provisioning-templates/${this.getGreengrassFleetProvisioningTemplate().templateName}/provision/*`
                            ],
                        }),
                        new PolicyStatement({
                            effect: Effect.ALLOW,
                            actions: [
                                'iot:Subscribe',
                            ],
                            resources: [
                                `arn:aws:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topicfilter/$aws/certificates/create/*`,
                                `arn:aws:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topicfilter/$aws/provisioning-templates/${this.getGreengrassFleetProvisioningTemplate().templateName}/provision/*`,
                            ],
                        })],
                })
            });
            const policyPrincipalAttachment = new CfnPolicyPrincipalAttachment(this, 'GGProvisioningClaimPolicyAttachment', {
                policyName: `${this.ggProvisioningClaimPolicy.policyName}`,
                principal: this.ggCertificateArnParam.valueAsString.replace('"', "")
            });
            policyPrincipalAttachment.addDependency(this.ggProvisioningClaimPolicy);
        }
        return this.ggProvisioningClaimPolicy;
    }

}

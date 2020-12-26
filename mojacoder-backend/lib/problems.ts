import * as cdk from '@aws-cdk/core'
import { join } from 'path';
import { GraphqlApi, MappingTemplate } from '@aws-cdk/aws-appsync';
import { PolicyStatement } from '@aws-cdk/aws-iam';
import { NodejsFunction } from '@aws-cdk/aws-lambda-nodejs';
import { Table, AttributeType, BillingMode } from '@aws-cdk/aws-dynamodb';
import { Bucket } from '@aws-cdk/aws-s3'
import { LambdaDestination } from '@aws-cdk/aws-s3-notifications'

export interface ProblemsProps {
    api: GraphqlApi
}

export class Problems extends cdk.Construct {
    public readonly testcases: Bucket
    
    constructor(scope: cdk.Construct, id: string, props: ProblemsProps) {
        super(scope, id);
        const problemTable = new Table(this, 'problem-table', {
            billingMode: BillingMode.PAY_PER_REQUEST,
            partitionKey: {
                name: 'id',
                type: AttributeType.STRING,
            },
        });
        problemTable.addGlobalSecondaryIndex({
            indexName: 'userID-index',
            partitionKey: {
                name: 'userID',
                type: AttributeType.STRING,
            },
            sortKey: {
                name: 'datetime',
                type: AttributeType.STRING,
            },
        });
        const likersTable = new Table(this, 'likers-table', {
            billingMode: BillingMode.PAY_PER_REQUEST,
            partitionKey: {
                name: 'problemID',
                type: AttributeType.STRING,
            },
            sortKey: {
                name: 'userID',
                type: AttributeType.STRING,
            }
        });
        likersTable.addGlobalSecondaryIndex({
            indexName: 'datetime-index',
            partitionKey: {
                name: 'problemID',
                type: AttributeType.STRING,
            },
            sortKey: {
                name: 'datetime',
                type: AttributeType.STRING,
            },
        });
        const commentTable = new Table(this, 'comment-table', {
            billingMode: BillingMode.PAY_PER_REQUEST,
            partitionKey: {
                name: 'commentID',
                type: AttributeType.STRING,
            },
        });
        commentTable.addGlobalSecondaryIndex({
            indexName: 'problem-index',
            partitionKey: {
                name: 'problemID',
                type: AttributeType.STRING,
            },
            sortKey: {
                name: 'datetime',
                type: AttributeType.STRING,
            },
        });
        const replyTable = new Table(this, 'reply-table', {
            billingMode: BillingMode.PAY_PER_REQUEST,
            partitionKey: {
                name: 'replyID',
                type: AttributeType.STRING,
            },
        });
        replyTable.addGlobalSecondaryIndex({
            indexName: 'comment-index',
            partitionKey: {
                name: 'commentID',
                type: AttributeType.STRING,
            },
            sortKey: {
                name: 'datetime',
                type: AttributeType.STRING,
            },
        });
        const postedProblems = new Bucket(this, 'postedProblems');
        this.testcases = new Bucket(this, 'testcases');
        const testcasesForView = new Bucket(this, 'testcases-for-view');
        const postedProblemsCreatedNotification = new NodejsFunction(this, 'postedProblemsCreatedNotification', {
            entry: join(__dirname, '../lambda/s3-posted-problems-created-notification/index.ts'),
            handler: 'handler',
            environment: {
                TABLE_NAME: problemTable.tableName,
                POSTED_PROBLEMS_BUCKET_NAME: postedProblems.bucketName,
                TESTCASES_BUCKET_NAME: this.testcases.bucketName,
                TESTCASES_FOR_VIEW_BUCKET_NAME: testcasesForView.bucketName,
            },
        });
        postedProblemsCreatedNotification.addToRolePolicy(new PolicyStatement({
            actions: ['s3:GetObject', 's3:PutObject', 'dynamodb:UpdateItem'],
            resources: [postedProblems.bucketArn + '/*', this.testcases.bucketArn + '/*', testcasesForView.bucketArn + '/*', problemTable.tableArn],
        }))
        postedProblems.addObjectCreatedNotification(new LambdaDestination(postedProblemsCreatedNotification), {
            suffix: '.zip'
        });
        const inTestcaseResolverLambda = new NodejsFunction(this, 'in-testcase-resolver', {
            entry: join(__dirname, '../lambda/in-testcase-resolver/index.ts'),
            handler: 'handler',
            environment: {
                TESTCASES_FOR_VIEW_BUCKET_NAME: testcasesForView.bucketName,
            },
        });
        inTestcaseResolverLambda.addToRolePolicy(new PolicyStatement({
            actions: ['s3:GetObject'],
            resources: [testcasesForView.bucketArn + '/*'],
        }))
        const inTestcaseResolverLambdaDatasource = props.api.addLambdaDataSource('inTestcaseResolver', inTestcaseResolverLambda)
        inTestcaseResolverLambdaDatasource.createResolver({
            typeName: 'Problem',
            fieldName: 'inTestcase',
        })
        const outTestcaseResolverLambda = new NodejsFunction(this, 'out-testcase-resolver', {
            entry: join(__dirname, '../lambda/out-testcase-resolver/index.ts'),
            handler: 'handler',
            environment: {
                TESTCASES_FOR_VIEW_BUCKET_NAME: testcasesForView.bucketName,
            },
        });
        outTestcaseResolverLambda.addToRolePolicy(new PolicyStatement({
            actions: ['s3:GetObject'],
            resources: [testcasesForView.bucketArn + '/*'],
        }))
        const outTestcaseResolverLambdaDatasource = props.api.addLambdaDataSource('outTestcaseResolver', outTestcaseResolverLambda)
        outTestcaseResolverLambdaDatasource.createResolver({
            typeName: 'Problem',
            fieldName: 'outTestcase',
        })
        const problemTableDataSource = props.api.addDynamoDbDataSource('problem_table', problemTable);
        problemTableDataSource.createResolver({
            typeName: 'Mutation',
            fieldName: 'postProblem',
            requestMappingTemplate: MappingTemplate.fromFile(join(__dirname, '../graphql/postProblem/request.vtl')),
            responseMappingTemplate: MappingTemplate.fromFile(join(__dirname, '../graphql/postProblem/response.vtl')),
        });
        problemTableDataSource.createResolver({
            typeName: 'UserDetail',
            fieldName: 'problem',
            requestMappingTemplate: MappingTemplate.fromFile(join(__dirname, '../graphql/problem/request.vtl')),
            responseMappingTemplate: MappingTemplate.fromFile(join(__dirname, '../graphql/problem/response.vtl')),
        });
        problemTableDataSource.createResolver({
            typeName: 'UserDetail',
            fieldName: 'problems',
            requestMappingTemplate: MappingTemplate.fromFile(join(__dirname, '../graphql/problems/request.vtl')),
            responseMappingTemplate: MappingTemplate.fromFile(join(__dirname, '../graphql/problems/response.vtl')),
        });
        const likeProblemDatasource = props.api.addDynamoDbDataSource('likeProblem', likersTable);
        likeProblemDatasource.grantPrincipal.addToPrincipalPolicy(new PolicyStatement({
            actions: ['dynamodb:UpdateItem'],
            resources: [problemTable.tableArn],
        }));
        likeProblemDatasource.createResolver({
            typeName: 'Mutation',
            fieldName: 'likeProblem',
            requestMappingTemplate: MappingTemplate.fromString(
                MappingTemplate.fromFile(join(__dirname, '../graphql/likeProblem/request.vtl')).renderTemplate()
                    .replace(/%LIKERS_TABLE%/g, likersTable.tableName)
                    .replace(/%PROBLEM_TABLE%/g, problemTable.tableName)
            ),
            responseMappingTemplate: MappingTemplate.fromFile(join(__dirname, '../graphql/likeProblem/response.vtl')),
        });
        const likersTableDatasource = props.api.addDynamoDbDataSource('likersTable', likersTable);
        likersTableDatasource.createResolver({
            typeName: 'Problem',
            fieldName: 'likedByMe',
            requestMappingTemplate: MappingTemplate.fromFile(join(__dirname, '../graphql/likedByMe/request.vtl')),
            responseMappingTemplate: MappingTemplate.fromFile(join(__dirname, '../graphql/likedByMe/response.vtl')),
        });
        likersTableDatasource.createResolver({
            typeName: 'Problem',
            fieldName: 'likers',
            requestMappingTemplate: MappingTemplate.fromFile(join(__dirname, '../graphql/likers/request.vtl')),
            responseMappingTemplate: MappingTemplate.fromFile(join(__dirname, '../graphql/likers/response.vtl')),
        });
        const postCommentDatasource = props.api.addDynamoDbDataSource('postComment', commentTable);
        postCommentDatasource.grantPrincipal.addToPrincipalPolicy(new PolicyStatement({
            actions: ['dynamodb:UpdateItem'],
            resources: [problemTable.tableArn],
        }))
        postCommentDatasource.createResolver({
            typeName: 'Mutation',
            fieldName: 'postComment',
            requestMappingTemplate: MappingTemplate.fromString(
                MappingTemplate.fromFile(join(__dirname, '../graphql/postComment/request.vtl')).renderTemplate()
                    .replace(/%COMMENT_TABLE%/g, commentTable.tableName)
                    .replace(/%PROBLEM_TABLE%/g, problemTable.tableName)
            ),
            responseMappingTemplate: MappingTemplate.fromFile(join(__dirname, '../graphql/postComment/response.vtl')),
        });
        const commentTableDatasource = props.api.addDynamoDbDataSource('commentTable', commentTable);
        commentTableDatasource.createResolver({
            typeName: 'Problem',
            fieldName: 'comments',
            requestMappingTemplate: MappingTemplate.fromFile(join(__dirname, '../graphql/comments/request.vtl')),
            responseMappingTemplate: MappingTemplate.fromFile(join(__dirname, '../graphql/comments/response.vtl')),
        });
        const postReplyDatasource = props.api.addDynamoDbDataSource('postReply', replyTable);
        postReplyDatasource.grantPrincipal.addToPrincipalPolicy(new PolicyStatement({
            actions: ['dynamodb:UpdateItem'],
            resources: [commentTable.tableArn],
        }))
        postReplyDatasource.createResolver({
            typeName: 'Mutation',
            fieldName: 'postReply',
            requestMappingTemplate: MappingTemplate.fromString(
                MappingTemplate.fromFile(join(__dirname, '../graphql/postReply/request.vtl')).renderTemplate()
                    .replace(/%REPLY_TABLE%/g, replyTable.tableName)
                    .replace(/%COMMENT_TABLE%/g, commentTable.tableName)
            ),
            responseMappingTemplate: MappingTemplate.fromFile(join(__dirname, '../graphql/postReply/response.vtl')),
        });
        const replyTableDatasource = props.api.addDynamoDbDataSource('replyTable', replyTable);
        replyTableDatasource.createResolver({
            typeName: 'Comment',
            fieldName: 'replies',
            requestMappingTemplate: MappingTemplate.fromFile(join(__dirname, '../graphql/replies/request.vtl')),
            responseMappingTemplate: MappingTemplate.fromFile(join(__dirname, '../graphql/replies/response.vtl')),
        });
    }
}

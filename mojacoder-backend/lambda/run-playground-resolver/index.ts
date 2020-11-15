import { AppSyncResolverHandler, AppSyncIdentityCognito } from 'aws-lambda'
import { S3, SQS } from 'aws-sdk'

const PLAYGROUND_CODE_BUCKET_NAME = process.env.PLAYGROUND_CODE_BUCKET_NAME as string;
if(PLAYGROUND_CODE_BUCKET_NAME === undefined) throw "PLAYGROUND_CODE_BUCKET_NAME is not defined.";
const JUDGEQUEUE_URL = process.env.JUDGEQUEUE_URL as string;
if(JUDGEQUEUE_URL === undefined) throw "JUDGEQUEUE_URL is not defined.";

const s3 = new S3({apiVersion: '2006-03-01'});
const sqs = new SQS({apiVersion: '2012-11-05'});

interface Arguments {
    sessionID: string
    lang: string
    code: string
    stdin: string
}

interface Response extends Arguments { }

type PLAYGROUND = 'PLAYGROUND';
interface JudgeQueueMessage {
    type: PLAYGROUND
    sessionID: string
    lang: string
    code: string
    stdin: string
    userID: string
}

export const handler: AppSyncResolverHandler<{ input: Arguments }, Response> = (event) => {
    return new Promise((resolve, reject) => {
        const { sessionID, lang, code, stdin } = event.arguments.input;
        const sub = (event.identity as AppSyncIdentityCognito).sub;
        s3.putObject({
            Body: code,
            Bucket: PLAYGROUND_CODE_BUCKET_NAME,
            Key: sessionID,
        }, (err) => {
            if(err) {
                reject(err);
                return;
            }
            const message: JudgeQueueMessage = {
                type: 'PLAYGROUND',
                sessionID,
                lang,
                code,
                stdin,
                userID: sub,
            };
            sqs.sendMessage({
                MessageBody: JSON.stringify(message),
                QueueUrl: JUDGEQUEUE_URL,
            }, (err) => {
                if(err) {
                    reject(err);
                    return;
                }
                resolve({
                    sessionID,
                    lang,
                    code,
                    stdin,
                });
            });
        });
    });
};

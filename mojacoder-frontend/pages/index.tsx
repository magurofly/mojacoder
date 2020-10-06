import React from 'react'
import { Jumbotron, Image } from 'react-bootstrap'

import styles from './index.module.css'

const GITHUB_LINK = 'https://github.com/makutamoto/mojacoder'
const TWITTER_LINK = 'https://twitter.com/makutamoto'

export const Index: React.FC = () => {
    return (
        <>
            <Jumbotron>
                <div className="text-center">
                    <Image
                        className={styles['top-image']}
                        src="/illustrations/undraw_programming_2svr.svg"
                    />
                    <h2 className="mt-4">
                        競技プログラミングの問題を投稿できるサイトです。
                    </h2>
                </div>
            </Jumbotron>
            <p>
                このサイトは
                <a href={TWITTER_LINK} target="_blank" rel="noreferrer">
                    @makutamoto
                </a>
                により制作されました。
                <br />
                GitHubリポジトリ 👉{' '}
                <a href={GITHUB_LINK} target="_blank" rel="noreferrer">
                    makutamoto/mojacoder
                </a>
            </p>
            <h2>タイムライン</h2>
        </>
    )
}

export default Index

import { Cloudinary } from 'cloudinary-core'
import join from 'url-join'

import { Problem } from './backend_types'

const cloudinary = new Cloudinary({
    ['cloud_name']: 'Makutamoto',
    secure: true,
})

export function generateProblemOGP(problem: Problem) {
    return cloudinary.url('mojacoder/ogp/problem/MojaCoderProblemOGP.png', {
        transformation: [
            {
                overlay: `text:Roboto_72:${encodeURIComponent(problem.title)}`,
                width: 1000,
                crop: 'fit',
                y: -27,
            },
            {
                overlay: `fetch:${
                    problem.user.detail.icon
                        ? join(
                              process.env.ICON_STORAGE,
                              `${problem.user.detail.userID}.png`
                          )
                        : 'https://mojacoder.vercel.app/images/avatar.png'
                }`,
                gravity: 'south_west',
                x: 30,
                y: 10,
                width: 64,
                radius: 'max',
            },
            {
                overlay: `text:Roboto_36:${encodeURIComponent(
                    problem.user.detail.screenName
                )}`,
                gravity: 'south_west',
                x: 104,
                y: 30,
                color: '#FFFFFF',
            },
        ],
    })
}

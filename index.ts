import dc from '@gurumnyang/dcinside.js';
import fs from 'fs';
import { CookieJar } from 'tough-cookie';
import { confusables } from 'unicode-confusables';

const targetGalleryId = 'spelunky';

const invisibleCharacters = new RegExp("[" + [160, 173, 847, 1564, 4447, 4448, 5760, 6068, 6069, 6155, 6156, 6157, 6158, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8203, 8204, 8205, 8206, 8207, 8234, 8235, 8236, 8237, 8238, 8239, 8287, 8288, 8289, 8290, 8291, 8292, 8293, 8294, 8295, 8296, 8297, 8298, 8299, 8300, 8301, 8302, 8303, 10240, 12288, 12644, 65279, 65440, 65529, 65530, 65531, 65532, 55308, 55348, 55348, 55348, 55348, 55348, 55348, 55348, 55348, 55348, 55348, 55348, 55348, 55348, 55348, 55348, 55348, 55348, 55348, 55348].map(c => String.fromCharCode(c)).join('') + "]", "g");

function removeFishy(str: string): string
{
    str = str.replace(invisibleCharacters, '');

    str = confusables(str).map(({ point, similarTo }) => {
        if(!similarTo || /[ㄱ-ㅎ가-힣0-9A-Za-z]/.test(point))
            return point;
        return similarTo;
    }).join('') as string;
    return str;
}

function tokenize(str: string): string[]
{
    return str.replace(/[^a-zA-Z0-9]+/g, v => ` ${v} `).split(' ').filter(v => v.length > 0);
}

type PostInfo = Awaited<ReturnType<typeof dc.getPostList>>[number]

async function login(): Promise<CookieJar>
{
    const result = await dc.mobileLogin({
        code: process.env.ID,
        password: process.env.PASSWORD
    });

    if (result.success){
        console.log('로그인 성공');
        return result.jar;
    } else{
        throw new Error(`로그인 실패: ${result.reason}`);
    }
}

class CookieJarRepository
{
    private static jarPromise: Promise<CookieJar> | null = null;
    private static COOKIES_FILE_PATH = './cookies.json';

    private static async getCookieJarFromFileOrLogin(): Promise<CookieJar>
    {
        if(fs.existsSync(this.COOKIES_FILE_PATH)){
            return CookieJar.deserializeSync(
                JSON.parse(fs.readFileSync(this.COOKIES_FILE_PATH, 'utf-8'))
            );
        } else {
            const jar = await login();
            fs.writeFileSync(this.COOKIES_FILE_PATH, JSON.stringify(jar.serializeSync()));
            return jar;
        }
    }

    static async getJar(): Promise<CookieJar>
    {
        if(!this.jarPromise){
            this.jarPromise = this.getCookieJarFromFileOrLogin();
        }
        return this.jarPromise;
    }
}

async function processPost(post: PostInfo)
{
    const title = removeFishy(post.title);
    const tokenized = tokenize(title);
    const hasAV = tokenized.find(token => token.toUpperCase() === 'AV');
    if(hasAV && title != post.title){
        const result = await dc.deletePost({
            galleryId: targetGalleryId,
            postId: post.id,
            jar: await CookieJarRepository.getJar()
        });

        if(result.success){
            console.log(`Deleted post ${post.id} - ${title}"`);
        } else {
            console.log(`Failed to delete post ${post.id} - ${title}: (${result.responseStatus}) ${result.message}`);
        }
    }
}

async function sleep(ms: number)
{
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run()
{
    const posts = await dc.getPostList({ page: 1, galleryId: targetGalleryId, boardType: 'all' })
    await Promise.all(posts.map(processPost))
}

async function main()
{
    for(let i=0; i!=4; ++i){
        await run();
        console.log(`run#${i+1} done.`)
        if(i+1!=4) await sleep(60000);
    }
}

main()

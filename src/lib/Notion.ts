import { Client } from '@notionhq/client';
import { NotionToMarkdown }  from "notion-to-md";
import readingTime from 'reading-time';

const NOTION_API_KEY = process.env.NOTION_API_KEY || '';
const POST_DATABASE_ID = process.env.POST_DATABASE_ID || '';
const SETTING_DATABASE_ID = process.env.SETTING_DATABASE_ID || '';

const notion = new Client({ auth: NOTION_API_KEY});
// passing notion client to the option
const n2m = new NotionToMarkdown({ notionClient: notion });

const Notion = {

    /**
     * Retrieves posts from a Notion database using the Notion API, with support for custom filters and sorting rules.
     *
     * @async
     * @function getPosts
     *
     * @param {Object} [options={}] - An optional object parameter.
     * @param {Object} [options.filter={}] - An optional object containing custom filters to apply to the query.
     * @param {Object} [options.sort={}] - An optional object containing custom sorting rules to apply to the query.
     *
     * @returns {Promise<Array>} A Promise that resolves to an array of post objects.
     *
     * @example
     *
     * const posts = await getPosts({ 
     *   filter: { 
     *     category: { equals: 'Technology' } 
     *   }, 
     *   sort: { 
     *     views: 'descending' 
     *   } 
     * });
     */
    async getPosts({ filter = {}, sort = {}} = {}) {
        let _filter : any = Object.entries(filter).map(([key, value] : [string, any]) => {
            return {
                property: key,
                ...value,
            };
        });

        let _sorts = Object.entries(sort).map(([key, value] : [string, any]) => {
            return {
                property: key,
                direction: value,
            };
        });

        const response = await notion.databases.query({
            database_id: POST_DATABASE_ID,
            filter: {
                and : [
                    {
                        property: 'published',
                        date: { before: new Date().toISOString() },
                    },
                    ..._filter,
                ]
            },
            sorts: [
                ..._sorts,
                {
                    property: 'published',
                    direction: 'descending',
                },
            ],
        });

        let posts = await this.convertNotionDatabaseToPosts(response.results);

        return posts;
    },
    

    async getPostBySlug(slug : string) {
        let post : any = {};
        const response = await notion.databases.query({
            database_id: POST_DATABASE_ID,
            filter: {
                property: 'slug',
                rich_text: { equals: slug },
            },
        });

        if(response.results.length === 0)
            return {};
        let posts = await this.convertNotionDatabaseToPosts(response.results);

        post = {
            ...(posts[0])
        };

        post.contents = await this.getChildern(post.id);

        return post;
    },

    async getTagsBySlug(slug : string) {
        let posts : any = [];
        const response = await notion.databases.query({
            database_id: POST_DATABASE_ID,
            filter: {
                property: 'tags',
                multi_select: { contains: slug },
            },
        });
        
        posts = await this.convertNotionDatabaseToPosts(response.results);

        return posts;
    },

    async getSettings() {
        let response = await notion.databases.query({
            database_id: SETTING_DATABASE_ID,
        });

        let settings = response.results.reduce((acc : any, item : any) => {
            let key = this.getProperties(item.properties.name).content;
            let value = this.getProperties(item.properties.value).content;
            acc[key] = value;
            return acc;
        }, {});

        return settings;
    },

    async getChildern(id : string) {
        let _this = this;
        const response = await notion.blocks.children.list({
            block_id: id,
        });

        let results : any = response.results;

        for (let i in results) {
            let item = results[i];
            if(item.has_children){
                let children = await _this.getChildern(item.id);
                results[i].children = children;
            }
            
        }

        return results;
    },


    async convertNotionDatabaseToPosts(notionDatabase : any) {
        return await Promise.all(notionDatabase.map(async (post : any) => {
            const mdblocks = await n2m.pageToMarkdown(post.id);
            const mdString = n2m.toMarkdownString(mdblocks);

            const {minutes} = readingTime(mdString);

            return {
                id: post.id,
                title: this.getProperties(post.properties.title).content,
                cover: this.getProperties(post.cover).url,
                published: this.getProperties(post.properties.published),
                slug: this.getProperties(post.properties.slug).content,
                tags: this.getProperties(post.properties.tags, true) || [],
                authors: this.getProperties(post.properties.authors, true),
                description: this.getProperties(post.properties.description).content,
                featured: this.getProperties(post.properties.featured),
                readingTime: Math.ceil(minutes),
            };
        }));
    },

    getProperties(param : any, isGetAllArray : boolean = false) : any{
        if (param && param instanceof Object && 'object' in param && param.object === 'user') {
            return param;
        } else if(param && param instanceof Object && 'type' in param) {
            return this.getProperties(param[param.type], isGetAllArray);
        } else if (param && param instanceof Array) {
            if(isGetAllArray){
                return param.map((item : any) => this.getProperties(item, isGetAllArray));
            }else{
                return this.getProperties(param[0], isGetAllArray);
            }
        } else {
            return param;
        }
    }
}


export default Notion;
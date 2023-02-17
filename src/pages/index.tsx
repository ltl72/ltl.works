import { PostList } from '@/components/molecules';
import { MainTemplate } from '@/components/templates';
import { Notion } from '@/lib';
import { GetStaticProps } from 'next';

interface HomePageProps {
  posts: any[]
  settings: any
}

const HomePage = ({posts, settings} : HomePageProps) => {
  return (
    <MainTemplate settings={settings}>
        <div className="layout mt-2">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Latest Posts</h2>
            <PostList posts={posts} />
        </div>
    </MainTemplate>
  );
}

export const getStaticProps: GetStaticProps = async (context) => {
  let posts = await Notion.getPosts({});
  let settings = await Notion.getSettings();

  return {
    props: {
      posts: posts,
      settings: settings
    },
    revalidate: 10
  }
}

export default HomePage
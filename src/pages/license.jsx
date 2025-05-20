import Layout from '@theme/Layout'
import { Section } from '@site/src/components/section'
import Md from '@site/src/markdown/license.md'

export default function App() {
  return (
    <Layout title='License' description=''>
      <Section id='license'>
        <div className='overflow-hidden bg-white pt-6 sm:pt-6 pb-24 sm:pb-32'>
          <div className='mx-auto'>
            <p className='text-base/7 font-semibold text-red-600'>License</p>
            <div className='prose w-full pt-6 max-w-none'>
              <Md />
            </div>
          </div>
        </div>
      </Section>
    </Layout>
  )
}

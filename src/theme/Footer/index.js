import React from 'react'
import { useThemeConfig } from '@docusaurus/theme-common'
import { Section } from '@site/src/components/section'

const navigation = {
  solutions: [
    { name: 'ClassCAD', href: 'https://classcad.ch' },
    { name: 'Buerli.io', href: 'https://buerli.io' },
    { name: 'Buerligons', href: 'https://dev.buerligons.io' },
  ],
  support: [
    { name: 'Submit ticket', href: 'mailto:support@awv-informatik.ch' },
    { name: 'Documentation', href: 'https://buerli.io/docs/' },
  ],
  company: [
    { name: 'About', href: 'https://awv-informatik.ch/' },
    { name: 'Blog', href: 'https://buerli.io/blog' },
  ],
  legal: [
    { name: 'Terms of service', href: '/tac' },
    { name: 'Privacy policy', href: '/privacy' },
    { name: 'License', href: '/license' },
  ],
  social: [
    {
      name: 'X',
      href: 'https://x.com/buerli_io',
      icon: (props) => (
        <svg fill='currentColor' viewBox='0 0 24 24' {...props}>
          <path d='M13.6823 10.6218L20.2391 3H18.6854L12.9921 9.61788L8.44486 3H3.2002L10.0765 13.0074L3.2002 21H4.75404L10.7663 14.0113L15.5685 21H20.8131L13.6819 10.6218H13.6823ZM11.5541 13.0956L10.8574 12.0991L5.31391 4.16971H7.70053L12.1742 10.5689L12.8709 11.5655L18.6861 19.8835H16.2995L11.5541 13.096V13.0956Z' />
        </svg>
      ),
    },
    {
      name: 'GitHub',
      href: 'https://github.com/awv-informatik/',
      icon: (props) => (
        <svg fill='currentColor' viewBox='0 0 24 24' {...props}>
          <path
            fillRule='evenodd'
            d='M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z'
            clipRule='evenodd'
          />
        </svg>
      ),
    },
    {
      name: 'YouTube',
      href: '#',
      icon: (props) => (
        <svg fill='currentColor' viewBox='0 0 24 24' {...props}>
          <path
            fillRule='evenodd'
            d='M19.812 5.418c.861.23 1.538.907 1.768 1.768C21.998 8.746 22 12 22 12s0 3.255-.418 4.814a2.504 2.504 0 0 1-1.768 1.768c-1.56.419-7.814.419-7.814.419s-6.255 0-7.814-.419a2.505 2.505 0 0 1-1.768-1.768C2 15.255 2 12 2 12s0-3.255.417-4.814a2.507 2.507 0 0 1 1.768-1.768C5.744 5 11.998 5 11.998 5s6.255 0 7.814.418ZM15.194 12 10 15V9l5.194 3Z'
            clipRule='evenodd'
          />
        </svg>
      ),
    },
  ],
}

function Footer() {
  const { footer } = useThemeConfig()
  if (!footer) {
    return null
  }
  return (
    <Section id='links'>
      <footer className='pt-16 pb-8 sm:pt-24 lg:pt-32'>
        <div className='xl:grid xl:grid-cols-3 xl:gap-8'>
          <div className='space-y-8'>
            <img alt='AWV Informatik AG' src='/favicon.png' className='h-9' />
            <p className='text-sm/6 text-balance text-gray-600'>On a mission to enable CAD everywhere.</p>
            <div className='flex gap-x-6'>
              {navigation.social.map((item) => (
                <a key={item.name} href={item.href} className='text-gray-600 hover:text-gray-800'>
                  <span className='sr-only'>{item.name}</span>
                  <item.icon aria-hidden='true' className='size-6' />
                </a>
              ))}
            </div>
          </div>
          <div className='mt-16 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0'>
            <div className='md:grid md:grid-cols-2 md:gap-8'>
              <div>
                <h3 className='text-sm/6 font-semibold text-gray-900'>Solutions</h3>
                <ul role='list' className='mt-6 space-y-4'>
                  {navigation.solutions.map((item) => (
                    <li key={item.name}>
                      <a href={item.href} className='text-sm/6 text-gray-600 hover:text-gray-900'>
                        {item.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <div className='mt-10 md:mt-0'>
                <h3 className='text-sm/6 font-semibold text-gray-900'>Support</h3>
                <ul role='list' className='mt-6 space-y-4'>
                  {navigation.support.map((item) => (
                    <li key={item.name}>
                      <a href={item.href} className='text-sm/6 text-gray-600 hover:text-gray-900'>
                        {item.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className='md:grid md:grid-cols-2 md:gap-8'>
              <div>
                <h3 className='text-sm/6 font-semibold text-gray-900'>Company</h3>
                <ul role='list' className='mt-6 space-y-4'>
                  {navigation.company.map((item) => (
                    <li key={item.name}>
                      <a href={item.href} className='text-sm/6 text-gray-600 hover:text-gray-900'>
                        {item.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <div className='mt-10 md:mt-0'>
                <h3 className='text-sm/6 font-semibold text-gray-900'>Legal</h3>
                <ul role='list' className='mt-6 space-y-4'>
                  {navigation.legal.map((item) => (
                    <li key={item.name}>
                      <a href={item.href} className='text-sm/6 text-gray-600 hover:text-gray-900'>
                        {item.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div className='mt-16 border-t border-gray-900/10 pt-8 sm:mt-20 lg:mt-24'>
          <p className='text-sm/6 text-gray-600'>&copy; 2025 AWV-Informatik AG, Inc. All rights reserved.</p>
        </div>
      </footer>
    </Section>
  )
}

export default React.memo(Footer)

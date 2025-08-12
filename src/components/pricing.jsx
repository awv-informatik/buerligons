import { useState } from 'react'
import { Radio, RadioGroup } from '@headlessui/react'
import { CheckIcon, XMarkIcon } from '@heroicons/react/20/solid'

const frequencies = [
  { value: 'monthly', label: 'Monthly', priceSuffix: '/month' },
  { value: 'annually', label: 'Annually', priceSuffix: '/year' }
]

const tiers = [
  {
    name: 'Free for Non-Commercial Use',
    id: 'tier-free',
    href: '#',
    price: 'Free',
    descriptions: [
      `If you're a student, hobbyist, or using Buerligons for non-commercial projects, it's free—enjoy with minimal restrictions!`,
      `Support Us with a Donation ❤️ Love Buerligons? Help us grow! Even if you use it for free, subscribing is a great way to contribute. Your support keeps development going!`
    ],
    featured: false,
    cta: 'Subscribe'
  },
  {
    name: 'Commercial Enduser / Developer Use',
    id: 'tier-enduser',
    href: '#',
    price: '100 CHF / year',
    descriptions: [
      `You develop with Buerli/Buerligons for commercial purposes without distribution, then you must obtain a enduser license.
      `
    ],
    featured: true,
    cta: 'Subscribe'
  }
]

function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}

export function Pricing() {
  const [frequency, setFrequency] = useState(frequencies[1])

  return (
    <div className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-base/7 font-semibold text-red-600">Pricing</h2>
          <p className="mt-2 text-5xl font-semibold tracking-tight text-balance text-gray-900 sm:text-6xl">Pricing that grows with you</p>
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-center text-lg font-medium text-pretty text-gray-600 sm:text-xl/8">
          At AWV Informatik AG, we offer transparent, fair pricing so everyone can access our cutting-edge CAD solutions.
          Please also read our <a href="https://awv-informatik.ch/blog/pricing">pricing blog</a>.
        </p>
        {tiers.some(tier => typeof tier.price === 'function') && <div className="mt-16 flex justify-center">
          <fieldset aria-label="Payment frequency">
            <RadioGroup
              value={frequency}
              onChange={setFrequency}
              className="grid grid-cols-2 gap-x-1 rounded-full p-1 text-center text-xs/5 font-semibold ring-1 ring-gray-200 ring-inset">
              {frequencies.map((option) => (
                <Radio
                  key={option.value}
                  value={option}
                  className="cursor-pointer rounded-full px-2.5 py-1 text-gray-500 data-checked:bg-red-600 data-checked:text-white">
                  {option.label}
                </Radio>
              ))}
            </RadioGroup>
          </fieldset>
        </div>}
        <div className="isolate mx-auto mt-10 grid max-w-md grid-cols-1 gap-8 lg:mx-0 lg:max-w-none lg:grid-cols-2">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={classNames(tier.featured ? 'bg-gray-900 ring-gray-900' : 'ring-gray-200', 'rounded-3xl p-8 ring-1 xl:p-10')}>
              <h3 id={tier.id} className={classNames(tier.featured ? 'text-white' : 'text-gray-900', 'text-lg/8 font-semibold')}>
                {tier.name}
              </h3>
              {tier.descriptions.map((description, index) => (
                <p key={index} className={classNames(tier.featured ? 'text-gray-300' : 'text-gray-600', 'mt-4 text-sm/6')}>
                  {description}
                </p>
              ))}
              <p className="mt-6 flex items-baseline gap-x-1">
                <span className={classNames(tier.featured ? 'text-white' : 'text-gray-900', 'text-4xl font-semibold tracking-tight')}>
                  {typeof tier.price === 'string' ? tier.price : tier.price[frequency.value]}
                </span>
                {typeof tier.price !== 'string' ? (
                  <span className={classNames(tier.featured ? 'text-gray-300' : 'text-gray-600', 'text-sm/6 font-semibold')}>
                    {frequency.priceSuffix}
                  </span>
                ) : null}
              </p>
              {tier.cta && (
                <a
                  href={tier.href}
                  aria-describedby={tier.id}
                  className={classNames(
                    tier.featured
                      ? 'bg-red-600 text-white hover:bg-white/20 focus-visible:outline-white'
                      : 'bg-red-600 text-white shadow-xs hover:bg-red-500 focus-visible:outline-red-600',
                    'mt-6 block rounded-md px-3 py-2 text-center text-sm/6 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2'
                  )}>
                  {tier.cta}
                </a>
              )}                          
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
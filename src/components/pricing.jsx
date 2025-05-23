import { PlusIcon } from '@heroicons/react/20/solid'

export function Pricing() {
  return (
    <div className="py-24 sm:py-32">
      <div className="mx-auto">
        <div className="w-full">
          <p className="text-base/7 font-semibold text-red-600">Pricing</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-pretty text-gray-900 sm:text-5xl">
            A fair, Value-Oriented Approach
          </h1>
          <p className="mt-6 text-xl/8 text-balance text-gray-700">
            We believe pricing should be fair, transparent, and aligned with the value our technology delivers.
            Solutions like ClassCAD, Buerli, and applications such as Buerligons serve a wide spectrum of users — from
            individual designers to enterprise teams integrating advanced CAD capabilities into large-scale platforms.
          </p>
          <p className="mt-6 text-xl/8 text-balance text-gray-700">
            A one-size-fits-all pricing model simply doesn’t do justice to this diversity.
          </p>
        </div>
      </div>

      <div className="relative w-[100%] left-[0%] md:w-[110%] md:left-[-5%] mx-auto mt-8 max-w-2xl rounded-3xl ring-1 ring-gray-200 lg:mx-0 lg:flex lg:max-w-none">
        <div className="p-8 sm:p-10 lg:flex-auto">
          <h3 className="text-3xl font-semibold tracking-tight text-gray-900">Flexible for Real-World Use Cases</h3>
          <p className="mt-6 text-base/7 text-gray-600">
            Vastly different scenarios highlight the need for flexibility — and our licensing model is designed to adapt
            accordingly.
          </p>
          <div className="mt-10 flex items-center gap-x-4">
            <h4 className="flex-none text-sm/6 font-semibold text-red-600">Consider the range of use cases:</h4>
            <div className="h-px flex-auto bg-gray-100" />
          </div>
          <ul role="list" className="mt-8 grid grid-cols-1 gap-4 text-sm/6 text-gray-600 sm:grid-cols-2 sm:gap-6">
            <li className="flex gap-x-3">
              <PlusIcon aria-hidden="true" className="h-6 w-5 flex-none text-red-600" />A solo developer could build a
              custom, industry-specific CAD system and deploy it to thousands via a WebAssembly-based web platform.
            </li>

            <li className="flex gap-x-3">
              <PlusIcon aria-hidden="true" className="h-6 w-5 flex-none text-red-600" />
              Another user may simply want to use Buerligons for personal, or commercial design projects.
            </li>
          </ul>
        </div>
        <div className="-mt-2 p-2 lg:mt-0 lg:w-full lg:max-w-md lg:shrink-0">
          <div className="h-full rounded-2xl bg-gray-50 py-10 text-center ring-1 ring-gray-900/5 ring-inset lg:flex lg:flex-col lg:justify-center lg:py-16">
            <div className="mx-auto max-w-xs px-8">
              <p className="text-base font-semibold text-gray-600">Tailored Tiers and Open Dialogue</p>
              <p className="mt-6 flex items-baseline justify-center gap-x-2">
                We offer clear base tiers for developers, users, and distributors, and we’re open to value-based
                discussions for unique cases — all to support your success.
              </p>
              <p className="mt-6 flex items-baseline justify-center gap-x-2">
                Explore our blog to find the pricing tier that fits your needs.
              </p>
              <a
                href="https://awv-informatik.ch/blog/pricing"
                className="mt-10 block w-full rounded-md bg-red-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-xs hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">
                Learn more ...
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import { cn } from '@/lib/utils'
import { SearchIcon, X } from 'lucide-react'
import { ComponentProps, forwardRef, useEffect, useState } from 'react'

const SearchInput = forwardRef<HTMLInputElement, ComponentProps<'input'>>(
  ({ value, onChange, className, ...props }, ref) => {
    const [displayClear, setDisplayClear] = useState(false)
    const [inputRef, setInputRef] = useState<HTMLInputElement | null>(null)

    useEffect(() => {
      setDisplayClear(!!value)
    }, [value])

    function setRefs(el: HTMLInputElement) {
      setInputRef(el)
      if (typeof ref === 'function') {
        ref(el)
      } else if (ref) {
        ;(ref as React.MutableRefObject<HTMLInputElement | null>).current = el
      }
    }

    return (
      <div
        tabIndex={0}
        className={cn(
          'flex h-9 w-full items-center rounded-xl border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-all duration-200 hover:border-ring/50 md:text-sm [&:has(:focus-visible)]:outline-hidden [&:has(:focus-visible)]:ring-2 [&:has(:focus-visible)]:ring-ring',
          className
        )}
      >
        <SearchIcon className="size-4 shrink-0 opacity-50" onClick={() => inputRef?.focus()} />
        <input
          {...props}
          name="search-input"
          ref={setRefs}
          value={value}
          onChange={onChange}
          className="mx-2 size-full border-none bg-transparent placeholder:text-muted-foreground focus:outline-hidden"
        />
        {displayClear && (
          <button
            type="button"
            className="flex size-5 shrink-0 flex-col items-center justify-center rounded-full bg-foreground/40 transition-opacity hover:bg-foreground"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange?.({ target: { value: '' } } as any)}
          >
            <X className="size-3! shrink-0 text-background" strokeWidth={4} />
          </button>
        )}
      </div>
    )
  }
)
SearchInput.displayName = 'SearchInput'
export default SearchInput

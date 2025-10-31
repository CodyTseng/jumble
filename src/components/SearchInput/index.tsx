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
          'flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors md:text-sm [&:has(:focus-visible)]:ring-ring [&:has(:focus-visible)]:ring-1 [&:has(:focus-visible)]:outline-none',
          className
        )}
        role="search"
      >
        <SearchIcon className="size-4 shrink-0 opacity-50" onClick={() => inputRef?.focus()} aria-hidden="true" />
        <input
          {...props}
          name="search-input"
          ref={setRefs}
          value={value}
          onChange={onChange}
          className="size-full mx-2 border-none bg-transparent focus:outline-none placeholder:text-muted-foreground"
          aria-label="Search"
        />
        {displayClear && (
          <button
            type="button"
            className="rounded-full bg-foreground/40 hover:bg-foreground transition-opacity size-5 shrink-0 flex flex-col items-center justify-center"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange?.({ target: { value: '' } } as any)}
            aria-label="Clear search"
          >
            <X className="!size-3 shrink-0 text-background" strokeWidth={4} aria-hidden="true" />
          </button>
        )}
      </div>
    )
  }
)
SearchInput.displayName = 'SearchInput'
export default SearchInput

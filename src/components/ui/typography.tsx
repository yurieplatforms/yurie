import { cn } from "@/lib/utils"
import React from "react"

export function TypographyH1({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1 
      className={cn("scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl", className)} 
      {...props}
    >
      {children}
    </h1>
  )
}

export function TypographyH2({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 
      className={cn("scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0", className)} 
      {...props}
    >
      {children}
    </h2>
  )
}

export function TypographyH3({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 
      className={cn("scroll-m-20 text-2xl font-semibold tracking-tight", className)} 
      {...props}
    >
      {children}
    </h3>
  )
}

export function TypographyH4({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h4 
      className={cn("scroll-m-20 text-xl font-semibold tracking-tight", className)} 
      {...props}
    >
      {children}
    </h4>
  )
}

export function TypographyP({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p 
      className={cn("leading-7 [&:not(:first-child)]:mt-6", className)} 
      {...props}
    >
      {children}
    </p>
  )
}

export function TypographyBlockquote({ className, children, ...props }: React.HTMLAttributes<HTMLQuoteElement>) {
  return (
    <blockquote 
      className={cn("mt-6 border-l-2 pl-6 italic", className)} 
      {...props}
    >
      {children}
    </blockquote>
  )
}

export function TypographyList({ className, children, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return (
    <ul 
      className={cn("my-6 ml-6 list-disc [&>li]:mt-2", className)} 
      {...props}
    >
      {children}
    </ul>
  )
}

export function TypographyInlineCode({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <code 
      className={cn("bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold", className)} 
      {...props}
    >
      {children}
    </code>
  )
}

export function TypographyLead({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p 
      className={cn("text-muted-foreground text-xl", className)} 
      {...props}
    >
      {children}
    </p>
  )
}

export function TypographyLarge({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      className={cn("text-lg font-semibold", className)} 
      {...props}
    >
      {children}
    </div>
  )
}

export function TypographySmall({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <small 
      className={cn("text-sm leading-none font-medium", className)} 
      {...props}
    >
      {children}
    </small>
  )
}

export function TypographyMuted({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p 
      className={cn("text-muted-foreground text-sm", className)} 
      {...props}
    >
      {children}
    </p>
  )
}

export function TypographyTable({ className, children, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="my-6 w-full overflow-y-auto">
      <table 
        className={cn("w-full", className)} 
        {...props}
      >
        {children}
      </table>
    </div>
  )
}

export function TypographyTh({ className, children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th 
      className={cn("border px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right", className)} 
      {...props}
    >
      {children}
    </th>
  )
}

export function TypographyTd({ className, children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td 
      className={cn("border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right", className)} 
      {...props}
    >
      {children}
    </td>
  )
}

export function TypographyTr({ className, children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr 
      className={cn("even:bg-muted m-0 border-t p-0", className)} 
      {...props}
    >
      {children}
    </tr>
  )
}

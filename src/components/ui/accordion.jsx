import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "../../lib/utils"

const Accordion = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("space-y-2", className)} {...props} />
))
Accordion.displayName = "Accordion"

const AccordionItem = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("border rounded-lg", className)}
    {...props}
  />
))
AccordionItem.displayName = "AccordionItem"

const AccordionTrigger = React.forwardRef(({ className, children, onClick, isOpen, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "flex flex-1 items-center justify-between py-4 px-4 font-medium transition-all hover:bg-muted/50 [&[data-state=open]>svg]:rotate-180",
      className
    )}
    onClick={onClick}
    data-state={isOpen ? "open" : "closed"}
    {...props}
  >
    {children}
    <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
  </button>
))
AccordionTrigger.displayName = "AccordionTrigger"

const AccordionContent = React.forwardRef(({ className, children, isOpen, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "overflow-hidden text-sm transition-all",
      isOpen ? "animate-accordion-down" : "animate-accordion-up",
      className
    )}
    style={{ display: isOpen ? "block" : "none" }}
    {...props}
  >
    <div className="px-4 pb-4 pt-0">{children}</div>
  </div>
))
AccordionContent.displayName = "AccordionContent"

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
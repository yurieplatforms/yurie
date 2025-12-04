"use client"

import * as React from "react"
import { motion } from "motion/react"
import { cn } from "@/utils"

interface ShiningTextProps {
  text: string
  className?: string
}

export function ShiningText({ text, className }: ShiningTextProps) {
  return (
    <motion.div
      className={cn(
        "bg-[linear-gradient(110deg,#404040,35%,#fff,50%,#404040,75%,#404040)] bg-[length:200%_100%] bg-clip-text text-base font-normal text-transparent dark:bg-[linear-gradient(110deg,#939393,45%,#fff,55%,#939393)]",
        className
      )}
      initial={{ backgroundPosition: "200% 0" }}
      animate={{ backgroundPosition: "-200% 0" }}
      transition={{
        repeat: Infinity,
        duration: 2,
        ease: "linear",
      }}
    >
      {text}
    </motion.div>
  )
}

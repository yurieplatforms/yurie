"use client"

import * as React from "react"
import { useState, useEffect, useRef } from "react";
import { Paperclip, Send, X, FileText, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

const PLACEHOLDERS = [
  "Generate website with HextaUI",
  "Create a new project with Next.js",
  "What is the meaning of life?",
  "What is the best way to learn React?",
  "How to cook a delicious meal?",
  "Summarize this article",
];

type AIChatInputProps = {
  onSend?: (text: string, files?: File[], options?: { model?: string }) => void
  isLoading?: boolean
  className?: string
}

const AIChatInput: React.FC<AIChatInputProps> = ({ onSend, isLoading = false, className }) => {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>("gpt-4.1");
  const [files, setFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<{ [key: string]: string }>({});
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputId = React.useId();

  // Cycle placeholder text when input is inactive
  useEffect(() => {
    if (isActive || inputValue) return;

    const interval = setInterval(() => {
      setShowPlaceholder(false);
      setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length);
        setShowPlaceholder(true);
      }, 400);
    }, 3000);

    return () => clearInterval(interval);
  }, [isActive, inputValue]);

  // Close input when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        if (!inputValue) setIsActive(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [inputValue]);

  // Persist model selection
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("yurie.model");
      if (saved) setSelectedModel(saved);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("yurie.model", selectedModel);
    } catch {}
  }, [selectedModel]);

  const handleActivate = () => setIsActive(true);

  // File handling functions
  const isImageFile = (file: File) => file.type.startsWith("image/");
  const isAllowedFile = (file: File) => 
    isImageFile(file) || file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  const processFile = (file: File) => {
    if (!isAllowedFile(file)) {
      console.log("Only images or PDFs are allowed");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      console.log("File too large (max 10MB)");
      return;
    }
    setFiles([file]);
    if (isImageFile(file)) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreviews({ [file.name]: (e.target?.result as string) });
      reader.readAsDataURL(file);
    } else {
      setFilePreviews({});
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
      if (e.target) e.target.value = "";
    }
  };

  const handleRemoveFile = (index: number) => {
    const fileToRemove = files[index];
    if (fileToRemove && filePreviews[fileToRemove.name]) {
      setFilePreviews({});
    }
    setFiles([]);
  };

  const handleSend = () => {
    const text = inputValue.trim();
    if ((!text && files.length === 0) || isLoading) return;
    onSend?.(text, files, { model: selectedModel });
    setInputValue("");
    setFiles([]);
    setFilePreviews({});
  };

  const placeholderContainerVariants = {
    initial: {},
    animate: { transition: { staggerChildren: 0.025 } },
    exit: { transition: { staggerChildren: 0.015, staggerDirection: -1 } },
  } as const;

  const letterVariants = {
    initial: {
      opacity: 0,
      filter: "blur(12px)",
      y: 10,
    },
    animate: {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      transition: {
        opacity: { duration: 0.25 },
        filter: { duration: 0.4 },
        y: { type: "spring", stiffness: 80, damping: 20 },
      },
    },
    exit: {
      opacity: 0,
      filter: "blur(12px)",
      y: -10,
      transition: {
        opacity: { duration: 0.2 },
        filter: { duration: 0.3 },
        y: { type: "spring", stiffness: 80, damping: 20 },
      },
    },
  } as const;

  return (
    <div className={className ? className : undefined}>
      <div
        ref={wrapperRef}
        className="w-full bg-white dark:bg-[#303030] text-neutral-900 dark:text-white border border-gray-200 dark:border-[#444444]"
        style={{ borderRadius: 32, boxShadow: "0 2px 8px 0 rgba(0,0,0,0.08)" }}
        onClick={handleActivate}
      >
        {/* File Previews */}
        <AnimatePresence>
          {files.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-2 px-4 pt-3 pb-2">
                {files.map((file, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                    className="relative group"
                  >
                    {file.type.startsWith("image/") && filePreviews[file.name] ? (
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden">
                        <img
                          src={filePreviews[file.name]}
                          alt={file.name}
                          className="h-full w-full object-cover"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFile(index);
                          }}
                          className="absolute top-1 right-1 rounded-full bg-gray-700/90 dark:bg-[#444444]/90 hover:bg-gray-800 dark:hover:bg-[#555555] p-0.5 opacity-100 transition-all"
                        >
                          <X className="h-3 w-3 text-white dark:text-gray-200" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-2 py-1 rounded-xl bg-gray-200 dark:bg-[#3A3A40] text-xs text-gray-800 dark:text-gray-100 border border-gray-300 dark:border-transparent">
                        <FileText className="w-4 h-4" />
                        <span className="max-w-[10rem] truncate">{file.name}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFile(index);
                          }}
                          className="ml-1 rounded-full bg-gray-300/80 dark:bg-[#555555]/80 hover:bg-gray-300 dark:hover:bg-[#666666] p-0.5 transition-all"
                        >
                          <X className="h-3 w-3 text-gray-700 dark:text-white" />
                        </button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2 p-3 rounded-full bg-white dark:bg-[#303030] max-w-3xl w-full">
          <input
            id={fileInputId}
            ref={fileInputRef}
            type="file"
            className="sr-only"
            onChange={handleFileSelect}
            accept="image/*,application/pdf"
          />
          <label
            htmlFor={fileInputId}
            className="p-3 rounded-full text-neutral-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-[#3A3A40] transition cursor-pointer"
            title="Attach file"
            onClick={(e) => e.stopPropagation()}
          >
            <Paperclip size={20} />
          </label>

          {/* Text Input & Placeholder */}
          <div className="relative flex-1">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleSend()
                }
              }}
              className="flex-1 border-0 outline-0 rounded-md py-2 text-base bg-transparent w-full font-normal text-neutral-900 dark:text-white placeholder:text-neutral-500"
              style={{ position: "relative", zIndex: 1 }}
              onFocus={handleActivate}
              disabled={isLoading}
            />
            <div className="absolute left-0 top-0 w-full h-full pointer-events-none flex items-center px-3 py-2">
              <AnimatePresence mode="wait">
                {showPlaceholder && !isActive && !inputValue && (
                  <motion.span
                    key={placeholderIndex}
                    className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-500 select-none pointer-events-none"
                    style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      zIndex: 0,
                    }}
                    variants={placeholderContainerVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                  >
                    {PLACEHOLDERS[placeholderIndex]
                      .split("")
                      .map((char, i) => (
                        <motion.span
                          key={i}
                          variants={letterVariants}
                          style={{ display: "inline-block" }}
                        >
                          {char === " " ? "\u00A0" : char}
                        </motion.span>
                      ))}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Model Selector - Segmented Control Style */}
          <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-[#3A3A40] rounded-full p-1">
            <button
              type="button"
              onClick={() => setSelectedModel("gpt-4.1")}
              disabled={isLoading}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all cursor-pointer ${
                selectedModel === "gpt-4.1"
                  ? "bg-white dark:bg-[#505050] text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-200"
              }`}
              title="GPT-4.1 - Fast and capable with vision"
            >
              4.1
            </button>
            <button
              type="button"
              onClick={() => setSelectedModel("gpt-5")}
              disabled={isLoading}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all cursor-pointer ${
                selectedModel === "gpt-5"
                  ? "bg-white dark:bg-[#505050] text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-200"
              }`}
              title="GPT-5 - Most capable with reasoning"
            >
              5
            </button>
          </div>

          <button
            className="flex items-center gap-1 bg-black hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-white/90 p-3 rounded-full font-medium justify-center disabled:opacity-50 cursor-pointer"
            title="Send"
            type="button"
            tabIndex={-1}
            onClick={handleSend}
            disabled={(!inputValue.trim() && files.length === 0) || isLoading}
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export { AIChatInput };



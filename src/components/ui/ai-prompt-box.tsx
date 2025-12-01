import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { CornerRightUp, Paperclip, Square, X, StopCircle, FileText } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Utility function for className merging
const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(" ");

// Embedded CSS for minimal custom styles
const styles = `
  *:focus-visible {
    outline-offset: 0 !important;
    --ring-offset: 0 !important;
  }
  textarea::-webkit-scrollbar {
    width: 6px;
  }
  textarea::-webkit-scrollbar-track {
    background: transparent;
  }
  textarea::-webkit-scrollbar-thumb {
    background-color: var(--color-gray-600, #52525b);
    border-radius: 3px;
  }
  textarea::-webkit-scrollbar-thumb:hover {
    background-color: var(--color-gray-500, #71717a);
  }
`;

// Style injection tracker to prevent duplicate injection
let stylesInjected = false;

function injectStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  const styleSheet = document.createElement("style");
  styleSheet.id = "ai-prompt-box-styles";
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
  stylesInjected = true;
}

// Textarea Component
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "flex w-full rounded-[var(--radius-card)] border-none bg-transparent pl-2 pr-2 py-1.5 text-base text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 min-h-[36px] resize-none scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-600 scrollbar-track-transparent hover:scrollbar-thumb-zinc-400 dark:hover:scrollbar-thumb-zinc-500",
        className
      )}
    ref={ref}
    rows={1}
    {...props}
  />
));
Textarea.displayName = "Textarea";

// Tooltip Components (Removed as they were causing unused variable errors and not used)
const TooltipProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;

// Dialog Components
const Dialog = DialogPrimitive.Root;
const DialogPortal = DialogPrimitive.Portal;
const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-[90vw] md:max-w-[800px] translate-x-[-50%] translate-y-[-50%] gap-4 border border-[var(--color-border)] bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] p-0 shadow-xl duration-[var(--transition-slow)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 rounded-[var(--radius-dialog)]",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 z-10 rounded-[var(--radius-full)] bg-[var(--color-surface)] p-2 hover:bg-[var(--color-surface-hover)] transition-all duration-[var(--transition-base)] cursor-pointer">
        <X className="h-5 w-5 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight text-[var(--color-foreground)]", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

// Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variantClasses = {
      default: "bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-zinc-50 dark:text-zinc-900",
      outline: "border border-zinc-200 dark:border-zinc-700 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800",
      ghost: "bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800",
    };
    const sizeClasses = {
      default: "h-10 px-4 py-2",
      sm: "h-8 px-3 text-sm",
      lg: "h-12 px-6",
      icon: "h-8 w-8 rounded-full aspect-[1/1]",
    };
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

// VoiceRecorder Component
interface VoiceRecorderProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: (duration: number) => void;
  visualizerBars?: number;
}
const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  isRecording,
  onStartRecording,
  onStopRecording,
  visualizerBars = 32,
}) => {
  const [time, setTime] = React.useState(0);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);
  const wasRecordingRef = React.useRef(false);
  const finalTimeRef = React.useRef(0);

  // Track time for stop callback
  React.useEffect(() => {
    finalTimeRef.current = time;
  }, [time]);

  React.useEffect(() => {
    if (isRecording && !wasRecordingRef.current) {
      // Started recording
      wasRecordingRef.current = true;
      onStartRecording();
      timerRef.current = setInterval(() => setTime((t) => t + 1), 1000);
    } else if (!isRecording && wasRecordingRef.current) {
      // Stopped recording
      wasRecordingRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      onStopRecording(finalTimeRef.current);
      setTime(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording, onStartRecording, onStopRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center w-full transition-all duration-[var(--transition-slow)] py-3",
        isRecording ? "opacity-100" : "opacity-0 h-0"
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="h-2 w-2 rounded-[var(--radius-full)] bg-[var(--color-destructive)] animate-pulse" />
        <span className="font-mono text-sm text-[var(--color-foreground)]/80">{formatTime(time)}</span>
      </div>
      <div className="w-full h-10 flex items-center justify-center gap-0.5 px-4">
        {[...Array(visualizerBars)].map((_, i) => (
          <div
            key={i}
            className="w-0.5 rounded-[var(--radius-full)] bg-[var(--color-foreground)]/50 animate-pulse"
            style={{
              height: `${Math.max(15, Math.random() * 100)}%`,
              animationDelay: `${i * 0.05}s`,
              animationDuration: `${0.5 + Math.random() * 0.5}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

// ImageViewDialog Component
interface ImageViewDialogProps {
  imageUrl: string | null;
  onClose: () => void;
}
const ImageViewDialog: React.FC<ImageViewDialogProps> = ({ imageUrl, onClose }) => {
  if (!imageUrl) return null;
  return (
    <Dialog open={!!imageUrl} onOpenChange={onClose}>
      <DialogContent className="p-0 border-none bg-transparent shadow-none max-w-[90vw] md:max-w-[800px]">
        <DialogTitle className="sr-only">Image Preview</DialogTitle>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] rounded-[var(--radius-card)] overflow-hidden shadow-2xl"
        >
          <img
            src={imageUrl}
            alt="Full preview"
            className="w-full max-h-[80vh] object-contain rounded-[var(--radius-card)]"
          />
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

// PromptInput Context and Components
interface PromptInputContextType {
  isLoading: boolean;
  value: string;
  setValue: (value: string) => void;
  maxHeight: number | string;
  onSubmit?: () => void;
  disabled?: boolean;
}
const PromptInputContext = React.createContext<PromptInputContextType>({
  isLoading: false,
  value: "",
  setValue: () => {},
  maxHeight: 240,
  onSubmit: undefined,
  disabled: false,
});
function usePromptInput() {
  const context = React.useContext(PromptInputContext);
  if (!context) throw new Error("usePromptInput must be used within a PromptInput");
  return context;
}

interface PromptInputProps {
  isLoading?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
  maxHeight?: number | string;
  onSubmit?: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}
const PromptInput = React.forwardRef<HTMLDivElement, PromptInputProps>(
  (
    {
      className,
      isLoading = false,
      maxHeight = 240,
      value,
      onValueChange,
      onSubmit,
      children,
      disabled = false,
      onDragOver,
      onDragLeave,
      onDrop,
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState(value || "");
    const handleChange = (newValue: string) => {
      setInternalValue(newValue);
      onValueChange?.(newValue);
    };
    return (
      <TooltipProvider>
        <PromptInputContext.Provider
          value={{
            isLoading,
            value: value ?? internalValue,
            setValue: onValueChange ?? handleChange,
            maxHeight,
            onSubmit,
            disabled,
          }}
        >
          <div
            ref={ref}
            className={cn(
              "rounded-[var(--radius-prompt)] bg-[var(--color-prompt-bg)] p-2 shadow-[var(--shadow-lg)] transition-all duration-[var(--transition-slow)]",
              className
            )}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            {children}
          </div>
        </PromptInputContext.Provider>
      </TooltipProvider>
    );
  }
);
PromptInput.displayName = "PromptInput";

interface PromptInputTextareaProps {
  disableAutosize?: boolean;
  placeholder?: string;
}
const PromptInputTextarea: React.FC<PromptInputTextareaProps & React.ComponentProps<typeof Textarea>> = ({
  className,
  onKeyDown,
  disableAutosize = false,
  placeholder,
  ...props
}) => {
  const { value, setValue, maxHeight, onSubmit, disabled } = usePromptInput();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (disableAutosize || !textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height =
      typeof maxHeight === "number"
        ? `${Math.min(textareaRef.current.scrollHeight, maxHeight)}px`
        : `min(${textareaRef.current.scrollHeight}px, ${maxHeight})`;
  }, [value, maxHeight, disableAutosize]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.();
    }
    onKeyDown?.(e);
  };

  return (
    <Textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      className={cn("text-base", className)}
      disabled={disabled}
      placeholder={placeholder}
      {...props}
    />
  );
};


// Main PromptInputBox Component
interface PromptInputBoxProps {
  onSend?: (message: string, files?: File[]) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}
export const PromptInputBox = React.forwardRef((props: PromptInputBoxProps, ref: React.Ref<HTMLDivElement>) => {
  const { onSend = () => {}, isLoading = false, placeholder = "Type your message here...", className } = props;
  const [input, setInput] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [filePreviews, setFilePreviews] = React.useState<{ [key: string]: string }>({});
  const [selectedImage, setSelectedImage] = React.useState<string | null>(null);
  const [isRecording, setIsRecording] = React.useState(false);
  const uploadInputRef = React.useRef<HTMLInputElement>(null);
  const promptBoxRef = React.useRef<HTMLDivElement>(null);

  // Inject styles on mount
  React.useEffect(() => {
    injectStyles();
  }, []);

  // File type detection helpers
  const isImageFile = React.useCallback((file: File) => file.type.startsWith("image/"), []);
  
  const isPdfFile = React.useCallback((file: File) => 
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"), []);
  
  const isTextFile = React.useCallback((file: File) => {
    const textTypes = ["text/plain", "text/markdown", "text/csv"];
    const textExtensions = [".txt", ".md", ".csv"];
    return (
      textTypes.includes(file.type) ||
      textExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))
    );
  }, []);

  const isSupportedFile = React.useCallback((file: File) => 
    isImageFile(file) || isPdfFile(file) || isTextFile(file), 
    [isImageFile, isPdfFile, isTextFile]);

  const processFile = React.useCallback((file: File) => {
    // Validate file type
    if (!isSupportedFile(file)) {
      console.log("Unsupported file type. Use images, PDFs, or text files.");
      return;
    }
    
    // Size limits based on file type (following Anthropic best practices)
    const maxSize = isImageFile(file) ? 5 * 1024 * 1024 : 10 * 1024 * 1024; // 5MB for images, 10MB for documents
    if (file.size > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024);
      console.log(`File too large (max ${maxSizeMB}MB for ${isImageFile(file) ? 'images' : 'documents'})`);
      return;
    }
    
    setFiles((prev) => [...prev, file]);
    
    // Only create previews for images
    if (isImageFile(file)) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreviews((prev) => ({ ...prev, [file.name]: e.target?.result as string }));
      reader.readAsDataURL(file);
    }
  }, [isSupportedFile, isImageFile]);

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFiles = Array.from(e.dataTransfer.files);
    // Process all supported files (images, PDFs, text files)
    const supportedFiles = droppedFiles.filter((file) => isSupportedFile(file));
    supportedFiles.forEach((file) => processFile(file));
  }, [isSupportedFile, processFile]);

  const handleRemoveFile = (index: number) => {
    const fileToRemove = files[index];
    if (fileToRemove && filePreviews[fileToRemove.name]) {
      setFilePreviews((prev) => {
        const newPreviews = { ...prev };
        delete newPreviews[fileToRemove.name];
        return newPreviews;
      });
    }
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const openImageModal = (imageUrl: string) => setSelectedImage(imageUrl);

  const handlePaste = React.useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          processFile(file);
          break;
        }
      }
    }
  }, [processFile]);

  React.useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  const handleSubmit = () => {
    if (input.trim() || files.length > 0) {
      onSend(input, files);
      setInput("");
      setFiles([]);
      setFilePreviews({});
    }
  };

  const handleStartRecording = () => console.log("Started recording");

  const handleStopRecording = (duration: number) => {
    console.log(`Stopped recording after ${duration} seconds`);
    setIsRecording(false);
    onSend(`[Voice message - ${duration} seconds]`, []);
  };

  const hasContent = input.trim() !== "" || files.length > 0;

  return (
    <>
      <PromptInput
        value={input}
        onValueChange={setInput}
        isLoading={isLoading}
        onSubmit={handleSubmit}
        className={cn(
          "rounded-[var(--radius-prompt)] bg-[var(--color-surface)] dark:bg-[var(--color-prompt-dark-bg)] p-2 shadow-[var(--shadow-lg)] transition-all duration-[var(--transition-slow)] ease-in-out",
          className
        )}
        disabled={isLoading || isRecording}
        ref={ref || promptBoxRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <AnimatePresence mode="popLayout">
          {files.length > 0 && !isRecording && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: "auto", marginBottom: 8 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="flex flex-wrap gap-2 w-full overflow-hidden"
            >
              <AnimatePresence mode="popLayout">
                {files.map((file, index) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.8, width: 0 }}
                    animate={{ opacity: 1, scale: 1, width: "auto" }}
                    exit={{ opacity: 0, scale: 0.8, width: 0 }}
                    transition={{ 
                      type: "spring",
                      stiffness: 400,
                      damping: 30
                    }}
                    key={`${file.name}-${index}`}
                    className="relative group overflow-hidden"
                  >
                    {/* Image preview */}
                    {isImageFile(file) && filePreviews[file.name] && (
                      <div
                        className="w-16 h-16 rounded-[var(--radius-card)] overflow-hidden cursor-pointer transition-all duration-[var(--transition-slow)]"
                        onClick={() => openImageModal(filePreviews[file.name])}
                      >
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
                          className="absolute top-1 right-1 rounded-full bg-black/70 p-0.5 opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3 text-white" />
                        </button>
                      </div>
                    )}
                    {/* Document preview (PDF and text files) */}
                    {(isPdfFile(file) || isTextFile(file)) && (
                      <div className="relative flex items-center gap-2 px-3 py-2 rounded-[var(--radius-card)] bg-[var(--color-surface-hover)] transition-all duration-[var(--transition-slow)]">
                        <FileText className="h-5 w-5 text-[var(--color-muted-foreground)]" />
                        <span className="text-sm text-[var(--color-foreground)] max-w-[120px] truncate">
                          {file.name}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFile(index);
                          }}
                          className="ml-1 rounded-[var(--radius-full)] bg-[var(--color-muted)] p-0.5 hover:bg-[var(--color-surface-hover)] transition-colors duration-[var(--transition-base)]"
                        >
                          <X className="h-3 w-3 text-[var(--color-muted-foreground)]" />
                        </button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-end gap-0 w-full">
          <div className="flex items-center gap-2 pb-0.5">
            <button
              onClick={() => uploadInputRef.current?.click()}
              className={cn(
                "flex h-8 w-8 text-[var(--color-muted-foreground)] cursor-pointer items-center justify-center rounded-[var(--radius-full)] transition-all duration-[var(--transition-base)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)] active:bg-[var(--color-surface-active)] active:scale-95",
                isRecording && "hidden"
              )}
              disabled={isRecording}
            >
              <Paperclip className="h-4 w-4 transition-colors" />
              <input
                ref={uploadInputRef}
                type="file"
                className="hidden"
                multiple
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    Array.from(e.target.files).forEach((file) => processFile(file));
                  }
                  if (e.target) e.target.value = "";
                }}
                accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,.txt,.md,.csv"
              />
            </button>
          </div>

          <div
            className={cn(
              "flex-1 transition-all duration-300 min-w-0",
              isRecording ? "h-0 overflow-hidden opacity-0" : "opacity-100"
            )}
          >
            <PromptInputTextarea
              placeholder={placeholder}
              className="text-base"
            />
          </div>

          {isRecording && (
            <div className="flex-1 min-w-0">
              <VoiceRecorder
                isRecording={isRecording}
                onStartRecording={handleStartRecording}
                onStopRecording={handleStopRecording}
              />
            </div>
          )}

          <div className="flex items-center gap-2 pb-0.5">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8 rounded-[var(--radius-full)] transition-all duration-[var(--transition-base)] cursor-pointer",
                isRecording
                  ? "bg-transparent hover:bg-[var(--color-destructive)]/15 active:bg-[var(--color-destructive)]/25 text-[var(--color-destructive)] hover:text-[var(--color-destructive)]"
                  : hasContent
                  ? "!bg-[var(--color-accent)] hover:!bg-[var(--color-accent-hover)] hover:shadow-lg active:scale-95 text-white"
                  : "bg-transparent hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-active)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
              )}
              onClick={() => {
                if (isRecording) setIsRecording(false);
                else if (hasContent) handleSubmit();
              }}
              disabled={isLoading || (!hasContent && !isRecording)}
            >
              {isLoading ? (
                <Square className="h-4 w-4 fill-current animate-pulse" />
              ) : isRecording ? (
                <StopCircle className="h-5 w-5 text-[var(--color-destructive)]" />
              ) : (
                <CornerRightUp className="h-4 w-4 text-current" strokeWidth={2.5} />
              )}
            </Button>
          </div>
        </div>
      </PromptInput>

      <ImageViewDialog imageUrl={selectedImage} onClose={() => setSelectedImage(null)} />
    </>
  );
});
PromptInputBox.displayName = "PromptInputBox";


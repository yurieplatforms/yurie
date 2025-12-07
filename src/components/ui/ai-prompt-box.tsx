import React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { CornerRightUp, Square, X as XIcon, FileText, Plus, LayoutGrid, Mail, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/providers/auth-provider";

// --- Utility Function & Radix Primitives ---

type ClassValue = string | number | boolean | null | undefined;
function cn(...inputs: ClassValue[]): string { return inputs.filter(Boolean).join(" "); }

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;
const TooltipContent = React.forwardRef<React.ElementRef<typeof TooltipPrimitive.Content>, React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> & { showArrow?: boolean }>(({ className, sideOffset = 4, showArrow = false, ...props }, ref) => ( <TooltipPrimitive.Portal><TooltipPrimitive.Content ref={ref} sideOffset={sideOffset} className={cn("relative z-50 max-w-[280px] rounded-md bg-black text-white px-1.5 py-1 text-xs animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2", className)} {...props}>{props.children}{showArrow && <TooltipPrimitive.Arrow className="-my-px fill-black" />}</TooltipPrimitive.Content></TooltipPrimitive.Portal>));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverContent = React.forwardRef<React.ElementRef<typeof PopoverPrimitive.Content>, React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>>(({ className, align = "center", sideOffset = 4, ...props }, ref) => ( <PopoverPrimitive.Portal><PopoverPrimitive.Content ref={ref} align={align} sideOffset={sideOffset} className={cn("z-50 w-64 rounded-xl bg-[var(--color-surface)] dark:bg-[var(--color-input-bg)] p-2 text-[var(--color-foreground)] dark:text-white shadow-md outline-none animate-in data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 border border-[var(--color-border)]", className)} {...props} /></PopoverPrimitive.Portal>));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

const Dialog = DialogPrimitive.Root;
const DialogPortal = DialogPrimitive.Portal;
const DialogOverlay = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Overlay>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>>(({ className, ...props }, ref) => ( <DialogPrimitive.Overlay ref={ref} className={cn("fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className)} {...props} />));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;
const DialogContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>>(({ className, children, ...props }, ref) => ( <DialogPortal><DialogOverlay /><DialogPrimitive.Content ref={ref} className={cn("fixed left-[50%] top-[50%] z-50 grid w-full max-w-[90vw] md:max-w-[800px] translate-x-[-50%] translate-y-[-50%] gap-4 border-none bg-transparent p-0 shadow-none duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95", className)} {...props}><div className="relative bg-[var(--color-surface)] dark:bg-[var(--color-input-bg)] rounded-[28px] overflow-hidden shadow-2xl p-1">{children}<DialogPrimitive.Close className="absolute right-3 top-3 z-10 rounded-full bg-background/50 dark:bg-[var(--color-input-bg)] p-1 hover:bg-[var(--color-surface-hover)] transition-all"><XIcon className="h-5 w-5 text-[var(--color-muted-foreground)] dark:text-gray-200 hover:text-[var(--color-foreground)] dark:hover:text-white" /><span className="sr-only">Close</span></DialogPrimitive.Close></div></DialogPrimitive.Content></DialogPortal>));
DialogContent.displayName = DialogPrimitive.Content.displayName;
const DialogTitle = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Title>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>>(({ className, ...props }, ref) => ( <DialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

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
          className="relative bg-[var(--color-surface)] dark:bg-[var(--color-input-bg)] rounded-[var(--radius-card)] overflow-hidden shadow-2xl"
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

// --- Main Component ---

// Mock tools list for UI placeholder
const toolsList = [
  { id: 'gmail', name: 'Gmail', shortName: 'Gmail', icon: Mail, iconUrl: '/Gmail.svg', description: 'Send emails on your behalf' },
];

interface PromptInputBoxProps {
  onSend?: (message: string, files?: File[]) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  /** Controlled selected tools state */
  selectedTools?: string[];
  /** Callback when selected tools change */
  onSelectedToolsChange?: (tools: string[]) => void;
}

export const PromptInputBox = React.forwardRef<HTMLDivElement, PromptInputBoxProps>(
  ({ onSend = () => {}, isLoading = false, placeholder = "Message...", className, selectedTools: controlledSelectedTools, onSelectedToolsChange }, ref) => {
    const internalTextareaRef = React.useRef<HTMLTextAreaElement>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [value, setValue] = React.useState("");
    
    // State from previous implementation
    const [files, setFiles] = React.useState<File[]>([]);
    const [filePreviews, setFilePreviews] = React.useState<{ [key: string]: string }>({});
    const [selectedImage, setSelectedImage] = React.useState<string | null>(null);
    
    // Tools state - support both controlled and uncontrolled modes
    const [internalSelectedTools, setInternalSelectedTools] = React.useState<string[]>([]);
    const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);
    
    const { user } = useAuth();
    const router = useRouter();
    
    // Use controlled state if provided, otherwise use internal state
    const selectedTools = controlledSelectedTools ?? internalSelectedTools;
    const setSelectedTools = React.useCallback((tools: string[] | ((prev: string[]) => string[])) => {
      const newTools = typeof tools === 'function' ? tools(selectedTools) : tools;
      if (onSelectedToolsChange) {
        onSelectedToolsChange(newTools);
      } else {
        setInternalSelectedTools(newTools);
      }
    }, [selectedTools, onSelectedToolsChange]);

    React.useLayoutEffect(() => {
      const textarea = internalTextareaRef.current;
      if (textarea) {
        textarea.style.height = "auto";
        const newHeight = Math.min(textarea.scrollHeight, 200);
        textarea.style.height = `${newHeight}px`;
      }
    }, [value]);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);
    };

    // File handling helpers
    const isImageFile = React.useCallback((file: File) => file.type.startsWith("image/"), []);
    const isPdfFile = React.useCallback((file: File) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"), []);
    const isTextFile = React.useCallback((file: File) => {
        const textTypes = ["text/plain", "text/markdown", "text/csv"];
        const textExtensions = [".txt", ".md", ".csv"];
        return textTypes.includes(file.type) || textExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
    }, []);
    
    const isSupportedFile = React.useCallback((file: File) => isImageFile(file) || isPdfFile(file) || isTextFile(file), [isImageFile, isPdfFile, isTextFile]);

    const processFile = React.useCallback((file: File) => {
        if (!isSupportedFile(file)) return;
        setFiles((prev) => [...prev, file]);
        if (isImageFile(file)) {
            const reader = new FileReader();
            reader.onload = (e) => setFilePreviews((prev) => ({ ...prev, [file.name]: e.target?.result as string }));
            reader.readAsDataURL(file);
        }
    }, [isSupportedFile, isImageFile]);

    const handlePlusClick = () => {
      fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files) {
        Array.from(event.target.files).forEach((file) => processFile(file));
      }
      event.target.value = "";
    };

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
        if (value.trim() || files.length > 0) {
            onSend(value, files);
            setValue("");
            setFiles([]);
            setFilePreviews({});
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleSelectTool = (id: string) => {
        setSelectedTools((prev) => {
            // If already selected, deselect it
            if (prev.includes(id)) return [];
            // Only allow one tool at a time
            return [id];
        });
        setIsPopoverOpen(false);
    };

    const handleRemoveTool = (id: string) => {
        setSelectedTools((prev) => prev.filter(t => t !== id));
    };

    const hasValue = value.trim().length > 0 || files.length > 0;

    return (
      <div ref={ref} className={cn("flex flex-col rounded-[var(--radius-input)] p-2 transition-colors bg-[var(--color-input-bg)] border border-[var(--color-input-border)] cursor-text", className)}>
        <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            multiple 
            accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,.txt,.md,.csv"
        />
        
        {/* Image Previews Modal */}
        <ImageViewDialog imageUrl={selectedImage} onClose={() => setSelectedImage(null)} />

        {/* File Previews in Input */}
        <AnimatePresence mode="popLayout">
            {files.length > 0 && (
                <motion.div 
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: "auto", marginBottom: 8 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    className="flex flex-wrap gap-2 px-2 pt-2"
                >
                    {files.map((file, index) => (
                        <motion.div
                            layout
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            key={`${file.name}-${index}`}
                            className="relative group"
                        >
                            {isImageFile(file) && filePreviews[file.name] ? (
                                <div className="relative">
                                    <img 
                                        src={filePreviews[file.name]} 
                                        alt={file.name} 
                                        className="h-14 w-14 rounded-lg object-cover cursor-pointer"
                                        onClick={() => setSelectedImage(filePreviews[file.name])}
                                    />
                                    <button 
                                        onClick={() => handleRemoveFile(index)}
                                        className="absolute -top-1.5 -right-1.5 bg-black/70 rounded-full p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                    >
                                        <XIcon className="h-3 w-3" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 bg-[var(--color-surface-hover)] px-3 py-2 rounded-lg border border-[var(--color-border)]">
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-xs max-w-[100px] truncate">{file.name}</span>
                                    <button onClick={() => handleRemoveFile(index)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                                        <XIcon className="h-3 w-3" />
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </motion.div>
            )}
        </AnimatePresence>

        <textarea 
                ref={internalTextareaRef} 
                rows={1} 
                value={value} 
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={isLoading}
                className="custom-scrollbar w-full resize-none border-0 bg-transparent p-3 font-medium text-[var(--color-foreground)] dark:text-white placeholder:text-[var(--color-muted-foreground)] dark:placeholder:text-zinc-400 focus:ring-0 focus-visible:outline-none min-h-[48px]" 
            />

        <div className="mt-0.5 p-1 pt-0">
          <TooltipProvider delayDuration={100}>
            <div className="flex items-center gap-2">
              <Tooltip> 
                <TooltipTrigger asChild>
                    <button 
                        type="button" 
                        onClick={handlePlusClick} 
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-foreground)] dark:text-white transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:outline-none cursor-pointer"
                        disabled={isLoading}
                    >
                        <Plus className="h-5 w-5" />
                        <span className="sr-only">Attach file</span>
                    </button>
                </TooltipTrigger> 
                {files.length === 0 && <TooltipContent side="top" showArrow={true}><p>Attach file</p></TooltipContent>}
              </Tooltip>
              
              <Popover open={isPopoverOpen} onOpenChange={(open) => {
                if (open && !user) {
                  router.push('/login');
                  return;
                }
                setIsPopoverOpen(open);
              }}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <button 
                        type="button" 
                        className="flex h-8 items-center gap-2 rounded-full p-2 text-sm font-medium text-[var(--color-foreground)] dark:text-white transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-0 cursor-pointer"
                        disabled={isLoading}
                      >
                        <LayoutGrid className="h-4 w-4" />
                        {selectedTools.length === 0 && 'Apps'}
                      </button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  {!isPopoverOpen && selectedTools.length === 0 && <TooltipContent side="top" showArrow={true}><p>Explore Apps</p></TooltipContent>}
                </Tooltip>
                <PopoverContent side="top" align="start" className="w-64 dark:bg-[var(--color-input-bg)] dark:border-[var(--color-input-border)] p-1.5">
                  <div className="flex flex-col gap-0.5">
                    {toolsList.map(tool => (
                      <button 
                          key={tool.id} 
                          onClick={() => handleSelectTool(tool.id)} 
                          className={cn(
                              "flex w-full items-center gap-2.5 rounded-md p-2 text-left text-sm hover:bg-[var(--color-surface-hover)] dark:hover:bg-[#2f2f2f] transition-colors cursor-pointer",
                              selectedTools.includes(tool.id) && "bg-[var(--color-surface-active)] dark:bg-[#2f2f2f]"
                          )}
                      > 
                          <div className="h-7 w-7 rounded-md flex items-center justify-center shrink-0 bg-[var(--color-surface-hover)] dark:bg-[#2f2f2f]">
                            {tool.iconUrl ? (
                              <img src={tool.iconUrl} alt={tool.name} className="h-4 w-4 object-contain" />
                            ) : tool.icon ? (
                              <tool.icon className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                            ) : null}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium">{tool.name}</span>
                            </div>
                            <p className="text-[10px] font-medium text-[var(--color-muted-foreground)] truncate leading-tight">
                              {tool.description}
                            </p>
                          </div>
                          {selectedTools.includes(tool.id) && (
                            <div className="h-3.5 w-3.5 rounded-full bg-[var(--color-accent)] flex items-center justify-center shrink-0 self-center">
                              <Check className="h-2 w-2 text-white" strokeWidth={3} />
                            </div>
                          )}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Selected Apps Pills */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[300px]">
                <AnimatePresence>
                    {selectedTools.map(toolId => {
                        const tool = toolsList.find(t => t.id === toolId);
                        if (!tool) return null;
                        
                        return (
                            <motion.button
                                key={tool.id}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                onClick={() => handleRemoveTool(tool.id)}
                                className="flex h-8 items-center gap-2 rounded-full px-2.5 text-sm bg-[var(--color-surface-hover)] dark:bg-white/5 hover:bg-[var(--color-surface-active)] dark:hover:bg-white/10 cursor-pointer text-[var(--color-muted-foreground)] dark:text-zinc-300 transition-colors flex-shrink-0"
                            >
                                {tool.iconUrl ? (
                                  <img src={tool.iconUrl} alt={tool.name} className="h-4 w-4 object-contain" />
                                ) : tool.icon ? (
                                  <tool.icon className="h-4 w-4" />
                                ) : null}
                                <span className="whitespace-nowrap font-medium">{tool.shortName}</span>
                                <XIcon className="h-3 w-3 opacity-50" />
                            </motion.button>
                        );
                    })}
                </AnimatePresence>
              </div>

              {/* Send button */}
              <div className="ml-auto">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      type="submit" 
                      onClick={handleSubmit}
                      disabled={!hasValue || isLoading} 
                      className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] dark:hover:bg-[var(--color-accent-hover)] disabled:bg-zinc-300 dark:disabled:bg-zinc-700 cursor-pointer"
                    >
                      {isLoading ? (
                        <Square className="h-4 w-4 fill-current animate-pulse" />
                      ) : (
                        <CornerRightUp className="h-5 w-5" />
                      )}
                      <span className="sr-only">Send message</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" showArrow={true}><p>Send</p></TooltipContent>
                </Tooltip>
              </div>
            </div>
          </TooltipProvider>
        </div>
      </div>
    );
  }
);
PromptInputBox.displayName = "PromptInputBox";

import React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { CornerRightUp, Paperclip, Square, X, StopCircle, FileText, Plus, Github, Mic, Settings2, X as XIcon, Target, Sparkles, GitBranch, Music } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getFocusedRepo, type FocusedRepo } from "@/app/profile/actions";

// --- Utility Function & Radix Primitives ---

type ClassValue = string | number | boolean | null | undefined;
function cn(...inputs: ClassValue[]): string { return inputs.filter(Boolean).join(" "); }

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverContent = React.forwardRef<React.ElementRef<typeof PopoverPrimitive.Content>, React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>>(({ className, align = "center", sideOffset = 4, ...props }, ref) => ( <PopoverPrimitive.Portal><PopoverPrimitive.Content ref={ref} align={align} sideOffset={sideOffset} className={cn("z-50 w-64 rounded-xl bg-[var(--color-surface)] dark:bg-[var(--color-surface-elevated)] p-2 text-[var(--color-foreground)] dark:text-white shadow-md outline-none animate-in data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 border border-[var(--color-border)]", className)} {...props} /></PopoverPrimitive.Portal>));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

const Dialog = DialogPrimitive.Root;
const DialogPortal = DialogPrimitive.Portal;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogOverlay = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Overlay>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>>(({ className, ...props }, ref) => ( <DialogPrimitive.Overlay ref={ref} className={cn("fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className)} {...props} />));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;
const DialogContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>>(({ className, children, ...props }, ref) => ( <DialogPortal><DialogOverlay /><DialogPrimitive.Content ref={ref} className={cn("fixed left-[50%] top-[50%] z-50 grid w-full max-w-[90vw] md:max-w-[800px] translate-x-[-50%] translate-y-[-50%] gap-4 border-none bg-transparent p-0 shadow-none duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95", className)} {...props}><div className="relative bg-[var(--color-surface)] dark:bg-[var(--color-surface-elevated)] rounded-[28px] overflow-hidden shadow-2xl p-1">{children}<DialogPrimitive.Close className="absolute right-3 top-3 z-10 rounded-full bg-background/50 dark:bg-[var(--color-background)]/50 p-1 hover:bg-[var(--color-surface-hover)] dark:hover:bg-[var(--color-surface-hover)] transition-all"><XIcon className="h-5 w-5 text-[var(--color-muted-foreground)] dark:text-gray-200 hover:text-[var(--color-foreground)] dark:hover:text-white" /><span className="sr-only">Close</span></DialogPrimitive.Close></div></DialogPrimitive.Content></DialogPortal>));
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
          className="relative bg-[var(--color-surface)] dark:bg-[var(--color-surface-elevated)] rounded-[var(--radius-card)] overflow-hidden shadow-2xl"
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

// --- VoiceRecorder Component ---
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
        "flex items-center justify-center w-full transition-all duration-300 px-3",
        isRecording ? "opacity-100" : "opacity-0 hidden"
      )}
    >
      <div className="flex items-center gap-2 mr-3">
        <div className="h-2 w-2 rounded-full bg-[var(--color-destructive)] animate-pulse" />
        <span className="font-mono text-sm text-[var(--color-foreground)]/80">{formatTime(time)}</span>
      </div>
      <div className="flex-1 h-8 flex items-center gap-0.5">
        {[...Array(visualizerBars)].map((_, i) => (
          <div
            key={i}
            className="w-0.5 rounded-full bg-[var(--color-foreground)]/50 animate-pulse"
            style={{
              height: `${Math.max(20, Math.random() * 100)}%`,
              animationDelay: `${i * 0.05}s`,
              animationDuration: `${0.5 + Math.random() * 0.5}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

// --- Main Component ---

const toolsList = [
  { id: 'github', name: 'GitHub', shortName: 'GitHub', icon: Github, description: 'Access GitHub repositories' },
  { id: 'spotify', name: 'Spotify', shortName: 'Spotify', icon: Music, description: 'Control playback & manage music' },
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
    const [isRecording, setIsRecording] = React.useState(false);
    
    // Tools state - support both controlled and uncontrolled modes
    const [internalSelectedTools, setInternalSelectedTools] = React.useState<string[]>([]);
    
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
    
    const [focusedRepo, setFocusedRepo] = React.useState<FocusedRepo | null>(null);
    const [isLoadingFocusedRepo, setIsLoadingFocusedRepo] = React.useState(false);
    const [hasFetchedFocusedRepo, setHasFetchedFocusedRepo] = React.useState(false);

    const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);
    const [isImageDialogOpen, setIsImageDialogOpen] = React.useState(false);

    // Fetch focused repo on mount (once) so it's available when user opens tools popover
    React.useEffect(() => {
      if (!hasFetchedFocusedRepo && !isLoadingFocusedRepo) {
        setIsLoadingFocusedRepo(true);
        setHasFetchedFocusedRepo(true);
        getFocusedRepo().then(({ repo }) => {
          if (repo) setFocusedRepo(repo);
          setIsLoadingFocusedRepo(false);
        }).catch(() => {
          setIsLoadingFocusedRepo(false);
        });
      }
    }, [hasFetchedFocusedRepo, isLoadingFocusedRepo]);

    // React.useImperativeHandle(ref, () => internalTextareaRef.current!, []); // This expects ref to be HTMLTextAreaElement but our prop says HTMLDivElement. 
    // The previous component was a Div, let's keep it compatible or adjust the ref type. 
    // The parent likely expects a div ref for the container. I'll attach the forwarded ref to the container div.

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
            // Keep selectedTools - don't clear them so the tool choice persists
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
            if (prev.includes(id)) return prev;
            return [...prev, id];
        });
        setIsPopoverOpen(false);
    };

    const handleRemoveTool = (id: string) => {
        setSelectedTools((prev) => prev.filter(t => t !== id));
    };

    // Recording handlers
    const handleStartRecording = () => console.log("Started recording");
    const handleStopRecording = (duration: number) => {
        console.log(`Stopped recording after ${duration} seconds`);
        setIsRecording(false);
        onSend(`[Voice message - ${duration} seconds]`, []);
    };

    const hasValue = value.trim().length > 0 || files.length > 0;

    return (
      <div ref={ref} className={cn("flex flex-col rounded-[28px] p-2 shadow-lg transition-colors bg-white border dark:bg-[var(--color-surface-elevated)] dark:border-[var(--color-border)] cursor-text", className)}>
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
            {files.length > 0 && !isRecording && (
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

        {/* Recording UI */}
        {isRecording ? (
             <VoiceRecorder
                isRecording={isRecording}
                onStartRecording={handleStartRecording}
                onStopRecording={handleStopRecording}
             />
        ) : (
             <textarea 
                ref={internalTextareaRef} 
                rows={1} 
                value={value} 
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={isLoading}
                className="custom-scrollbar w-full resize-none border-0 bg-transparent p-3 text-[var(--color-foreground)] dark:text-white placeholder:text-[var(--color-muted-foreground)] dark:placeholder:text-zinc-400 focus:ring-0 focus-visible:outline-none min-h-[48px]" 
            />
        )}

        <div className="mt-0.5 p-1 pt-0">
              <div className="flex items-center gap-2">
                <button 
                    type="button" 
                    onClick={handlePlusClick} 
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-foreground)] dark:text-white transition-all duration-300 ease-out hover:bg-[var(--color-surface-hover)] dark:hover:bg-[var(--color-surface-hover)] active:scale-95 active:bg-[var(--color-surface-active)] dark:active:bg-[var(--color-surface-active)] focus-visible:outline-none cursor-pointer"
                    disabled={isRecording || isLoading}
                >
                    <Plus className="h-5 w-5" />
                    <span className="sr-only">Attach file</span>
                </button>
              
              <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button 
                      type="button" 
                      className="flex h-8 items-center gap-2 rounded-full p-2 text-sm text-[var(--color-foreground)] dark:text-white transition-all duration-300 ease-out hover:bg-[var(--color-surface-hover)] dark:hover:bg-[var(--color-surface-hover)] active:scale-95 active:bg-[var(--color-surface-active)] dark:active:bg-[var(--color-surface-active)] focus-visible:outline-none focus-visible:ring-0 cursor-pointer"
                      disabled={isRecording || isLoading}
                    >
                      <Settings2 className="h-4 w-4" />
                      {selectedTools.length === 0 && 'Tools'}
                    </button>
                  </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-64 dark:bg-[var(--color-surface-elevated)] dark:border-[var(--color-border)] p-1.5">
                  <div className="flex flex-col gap-0.5">
                    {toolsList.map(tool => {
                        const isGitHub = tool.id === 'github';
                        const hasFocusedRepo = isGitHub && focusedRepo;
                        
                        return (
                          <button 
                              key={tool.id} 
                              onClick={() => handleSelectTool(tool.id)} 
                              className={cn(
                                  "flex w-full items-center gap-2.5 rounded-md p-2 text-left text-sm hover:bg-[var(--color-surface-hover)] dark:hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer",
                                  selectedTools.includes(tool.id) && "bg-[var(--color-surface-active)] dark:bg-[var(--color-surface-active)]"
                              )}
                          > 
                              <div className={cn(
                                "h-7 w-7 rounded-md flex items-center justify-center shrink-0",
                                hasFocusedRepo 
                                  ? "bg-[var(--color-accent)]/20" 
                                  : "bg-[var(--color-surface-hover)] dark:bg-[var(--color-surface-hover)]"
                              )}>
                                {hasFocusedRepo ? (
                                  <Github className="h-4 w-4 text-[var(--color-accent)]" />
                                ) : (
                                  <tool.icon className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium">{tool.name}</span>
                                </div>
                                <p className="text-[10px] text-[var(--color-muted-foreground)] truncate leading-tight">
                                  {hasFocusedRepo ? (
                                    <span className="flex items-center gap-1">
                                      <GitBranch className="h-2.5 w-2.5" />
                                      {focusedRepo.fullName}
                                    </span>
                                  ) : (
                                    tool.description
                                  )}
                                </p>
                              </div>
                              {selectedTools.includes(tool.id) && (
                                <div className="h-3.5 w-3.5 rounded-full bg-[var(--color-accent)] flex items-center justify-center shrink-0 self-center">
                                  <XIcon className="h-2 w-2 text-white" />
                                </div>
                              )}
                          </button>
                        );
                    })}
                  </div>
                  
                </PopoverContent>
              </Popover>

              {/* Selected Tools Pills */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[300px]">
                <AnimatePresence>
                    {selectedTools.map(toolId => {
                        const tool = toolsList.find(t => t.id === toolId);
                        if (!tool) return null;
                        
                        // Special handling for GitHub with focused repo
                        if (tool.id === 'github' && focusedRepo) {
                          return (
                            <motion.button
                                key={tool.id}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                onClick={() => handleRemoveTool(tool.id)}
                                className="flex h-8 items-center gap-2 rounded-full px-2 text-sm bg-[var(--color-accent)]/10 text-[var(--color-accent)] transition-colors flex-shrink-0 border border-[var(--color-accent)]/20 hover:border-[var(--color-accent)]/40 cursor-pointer"
                            >
                                <Github className="h-4 w-4" />
                                <span className="whitespace-nowrap font-medium">
                                    {focusedRepo.name}
                                </span>
                                <XIcon className="h-3 w-3 opacity-50" />
                            </motion.button>
                          );
                        }
                        
                        return (
                            <motion.button
                                key={tool.id}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                onClick={() => handleRemoveTool(tool.id)}
                                className="flex h-8 items-center gap-2 rounded-full px-2 text-sm dark:hover:bg-[var(--color-surface-hover)] hover:bg-[var(--color-surface-hover)] cursor-pointer dark:text-[var(--color-accent)] text-[var(--color-accent)] transition-all duration-300 ease-out active:scale-95 active:bg-[var(--color-surface-active)] dark:active:bg-[var(--color-surface-active)] flex-shrink-0 border border-transparent hover:border-[var(--color-border)]"
                            >
                                <tool.icon className="h-4 w-4" />
                                <span className="whitespace-nowrap">{tool.shortName}</span>
                                <XIcon className="h-3 w-3 opacity-50" />
                            </motion.button>
                        );
                    })}
                </AnimatePresence>
              </div>

              {/* Right-aligned buttons container */}
              <div className="ml-auto flex items-center gap-2">
                {!isRecording && (
                        <button 
                            type="button" 
                            onClick={() => setIsRecording(true)}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-foreground)] dark:text-white transition-all duration-300 ease-out hover:bg-[var(--color-surface-hover)] dark:hover:bg-[var(--color-surface-hover)] active:scale-95 active:bg-[var(--color-surface-active)] dark:active:bg-[var(--color-surface-active)] focus-visible:outline-none cursor-pointer"
                            disabled={isLoading}
                        >
                        <Mic className="h-5 w-5" />
                        <span className="sr-only">Record voice</span>
                        </button>
                )}

                {isRecording ? (
                         <button 
                             type="button" 
                             onClick={() => handleStopRecording(0)} 
                             className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-destructive)] transition-all duration-300 ease-out hover:bg-[var(--color-surface-hover)] active:scale-95 focus-visible:outline-none cursor-pointer"
                         >
                         <StopCircle className="h-6 w-6 fill-current" />
                         <span className="sr-only">Stop recording</span>
                         </button>
                ) : (
                        <button 
                            type="submit" 
                            onClick={handleSubmit}
                            disabled={!hasValue || isLoading} 
                            className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] dark:hover:bg-[var(--color-accent-hover)] active:scale-95 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 cursor-pointer"
                        >
                        {isLoading ? (
                            <Square className="h-4 w-4 fill-current animate-pulse" />
                        ) : (
                            <CornerRightUp className="h-5 w-5" />
                        )}
                        <span className="sr-only">Send message</span>
                        </button>
                )}
              </div>
            </div>
        </div>
      </div>
    );
  }
);
PromptInputBox.displayName = "PromptInputBox";

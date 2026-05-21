import React, { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { 
  useGetMe, 
  useListConversations, 
  useGetConversationStats, 
  useListMessages,
  useSendMessage,
  useMarkConversationRead,
  useSearchUsers,
  useCreateConversation,
  getGetConversationStatsQueryKey,
  getListConversationsQueryKey,
  getListMessagesQueryKey,
  useAddReaction,
  useRemoveReaction,
  useEditMessage,
  useDeleteMessage,
  useGetConversation
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Send, Plus, Search, MessageSquare, Phone, MoreVertical, X, Check, Edit2, Trash2 } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import loopLogo from "@assets/IMG_3832_1779368920403.jpeg";

const formatMessageTime = (dateStr: string) => {
  const d = new Date(dateStr);
  return format(d, 'HH:mm');
};

const formatConversationDate = (dateStr: string) => {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'dd/MM/yyyy');
};

const EMOJIS = ["❤️", "😂", "😮", "😢", "👍", "🔥"];

export default function ChatsPage() {
  const params = useParams();
  const activeConvId = params.conversationId ? parseInt(params.conversationId, 10) : null;
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const { data: me } = useGetMe();
  const { data: conversations, isLoading: isLoadingConvs } = useListConversations({ query: { refetchInterval: 5000 } as any });
  const { data: stats } = useGetConversationStats({ query: { refetchInterval: 5000 } as any });
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const debouncedSearch = useDebounce(searchQuery, 300);
  const { data: searchResults, isLoading: isSearching } = useSearchUsers({ q: debouncedSearch }, { query: { enabled: debouncedSearch.length > 1 } as any });
  
  const createConversation = useCreateConversation();

  const handleStartChat = (userId: number) => {
    createConversation.mutate({ data: { type: "direct", memberIds: [userId] } }, {
      onSuccess: (conv) => {
        setIsSearchOpen(false);
        setSearchQuery("");
        setLocation(`/chats/${conv.id}`);
        queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
      }
    });
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar - hidden on mobile if chat is open */}
      <div className={`w-full md:w-80 lg:w-96 flex-shrink-0 flex flex-col border-r border-border bg-card/30 backdrop-blur-md transition-transform ${activeConvId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setLocation("/profile")}>
            <Avatar className="w-10 h-10 border border-primary/20">
              <AvatarImage src={me?.avatar || ""} />
              <AvatarFallback className="bg-muted text-primary">{me?.displayName?.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-semibold">{me?.displayName}</h2>
              <p className="text-xs text-primary">{stats?.totalUnread ? `${stats.totalUnread} unread` : "All caught up"}</p>
            </div>
          </div>
          <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost" className="rounded-full text-primary hover:text-primary hover:bg-primary/10">
                <Plus className="w-5 h-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border sm:max-w-md">
              <DialogHeader>
                <DialogTitle>New Chat</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search users..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-input/50"
                  />
                </div>
                <ScrollArea className="h-[300px]">
                  {isSearching ? (
                    <div className="text-center p-4 text-muted-foreground">Searching...</div>
                  ) : searchResults?.length ? (
                    <div className="space-y-2">
                      {searchResults.filter(u => u.id !== me?.id).map(user => (
                        <div key={user.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-xl cursor-pointer" onClick={() => handleStartChat(user.id)}>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={user.avatar || ""} />
                              <AvatarFallback>{user.displayName.substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{user.displayName}</p>
                              <p className="text-xs text-muted-foreground">{user.phone}</p>
                            </div>
                          </div>
                          <MessageSquare className="w-4 h-4 text-primary" />
                        </div>
                      ))}
                    </div>
                  ) : debouncedSearch.length > 1 ? (
                    <div className="text-center p-4 text-muted-foreground">No users found</div>
                  ) : (
                    <div className="text-center p-4 text-muted-foreground">Type to search for users</div>
                  )}
                </ScrollArea>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        
        <ScrollArea className="flex-1">
          {isLoadingConvs ? (
            <div className="p-4 space-y-4">
              {[1,2,3].map(i => <div key={i} className="flex gap-3"><div className="w-12 h-12 rounded-full bg-muted animate-pulse"/><div className="flex-1 space-y-2 py-1"><div className="h-4 bg-muted rounded w-1/3 animate-pulse"/><div className="h-3 bg-muted rounded w-2/3 animate-pulse"/></div></div>)}
            </div>
          ) : conversations?.length ? (
            <div className="p-2 space-y-1">
              {conversations.map(conv => {
                const otherMember = conv.members.find(m => m.userId !== me?.id)?.user;
                const name = conv.name || otherMember?.displayName || "Unknown";
                const avatar = conv.avatar || otherMember?.avatar;
                const isUnread = conv.unreadCount > 0;
                
                return (
                  <div 
                    key={conv.id}
                    onClick={() => setLocation(`/chats/${conv.id}`)}
                    className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-colors ${activeConvId === conv.id ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted/50'}`}
                  >
                    <div className="relative">
                      <Avatar className="w-12 h-12 border border-border">
                        <AvatarImage src={avatar || ""} />
                        <AvatarFallback className="bg-card text-foreground">{name.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      {otherMember?.isOnline && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <h3 className={`font-semibold truncate ${isUnread ? 'text-foreground' : 'text-foreground/80'}`}>{name}</h3>
                        {conv.lastMessage && (
                          <span className={`text-[10px] whitespace-nowrap ${isUnread ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                            {formatConversationDate(conv.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <p className={`text-sm truncate ${isUnread ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                          {conv.lastMessage?.content || "No messages yet"}
                        </p>
                        {isUnread && (
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground shadow-[0_0_10px_rgba(255,107,0,0.5)]">
                            {conv.unreadCount}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4 text-muted-foreground">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <MessageSquare className="w-8 h-8 opacity-50" />
              </div>
              <p>No conversations yet.<br/>Click + to start chatting.</p>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex-col bg-background/50 relative ${!activeConvId ? 'hidden md:flex' : 'flex'}`}>
        {activeConvId ? (
          <ActiveChat conversationId={activeConvId} me={me} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <img src={loopLogo} alt="Loop" className="w-24 h-24 mb-6 opacity-20 grayscale" />
            <p className="text-lg">Select a conversation to start messaging</p>
            <p className="text-sm">End-to-end encrypted • Hyper-fast</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ActiveChat({ conversationId, me }: { conversationId: number, me: any }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { data: conv } = useGetConversation(conversationId);
  const { data: messages, isLoading } = useListMessages(conversationId, { query: { refetchInterval: 3000 } as any });
  
  const sendMessage = useSendMessage();
  const markRead = useMarkConversationRead();
  const addReaction = useAddReaction();
  const removeReaction = useRemoveReaction();
  const editMessage = useEditMessage();
  const deleteMessage = useDeleteMessage();
  
  const [inputText, setInputText] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    markRead.mutate({ conversationId });
  }, [conversationId, markRead.mutate, messages?.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    
    if (editingId) {
      editMessage.mutate({ messageId: editingId, data: { content: inputText } }, {
        onSuccess: () => {
          setEditingId(null);
          setInputText("");
          queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(conversationId) });
        }
      });
    } else {
      sendMessage.mutate({ conversationId, data: { type: "text", content: inputText } }, {
        onSuccess: () => {
          setInputText("");
          queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(conversationId) });
          queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
        }
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const otherMember = conv?.members.find(m => m.userId !== me?.id)?.user;
  const name = conv?.name || otherMember?.displayName || "Loading...";
  const avatar = conv?.avatar || otherMember?.avatar;

  return (
    <>
      <div className="h-16 border-b border-border bg-card/80 backdrop-blur-xl flex items-center px-4 justify-between z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="md:hidden -ml-2" onClick={() => setLocation("/chats")}>
            <X className="w-5 h-5" />
          </Button>
          <Avatar className="w-10 h-10">
            <AvatarImage src={avatar || ""} />
            <AvatarFallback>{name.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-semibold leading-tight">{name}</h2>
            {otherMember?.isOnline && <p className="text-xs text-primary">Online</p>}
          </div>
        </div>
        <Button variant="ghost" size="icon">
          <Phone className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {isLoading ? (
          <div className="flex justify-center p-4"><div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin"/></div>
        ) : messages?.map((msg, index) => {
          const isMe = msg.senderId === me?.id;
          const showAvatar = !isMe && (index === messages.length - 1 || messages[index + 1]?.senderId !== msg.senderId);
          
          return (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={msg.id} 
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
            >
              <div className={`flex gap-2 max-w-[80%] ${isMe ? 'flex-row-reverse' : 'flex-row'} group`}>
                {!isMe && (
                  <div className="w-8 flex-shrink-0 flex items-end">
                    {showAvatar && (
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={msg.sender?.avatar || ""} />
                        <AvatarFallback>{msg.sender?.displayName?.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                )}
                
                <ContextMenu>
                  <ContextMenuTrigger>
                    <div className={`relative px-4 py-2.5 rounded-2xl ${isMe ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-card border border-border text-card-foreground rounded-bl-sm'} shadow-sm`}>
                      {msg.isDeleted ? (
                        <p className="italic opacity-70">This message was deleted</p>
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      )}
                      
                      <div className={`flex items-center gap-1 mt-1 text-[10px] ${isMe ? 'text-primary-foreground/70 justify-end' : 'text-muted-foreground'}`}>
                        {msg.editedAt && <span>edited</span>}
                        <span>{formatMessageTime(msg.createdAt)}</span>
                        {isMe && <Check className="w-3 h-3" />}
                      </div>

                      {msg.reactions && msg.reactions.length > 0 && (
                        <div className="absolute -bottom-3 left-4 flex gap-1 bg-background border border-border rounded-full px-1.5 py-0.5 shadow-sm">
                          {msg.reactions.map(r => (
                            <span key={r.userId} className="text-xs">{r.emoji}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-48">
                    {!msg.isDeleted && isMe && (
                      <>
                        <ContextMenuItem onClick={() => { setEditingId(msg.id); setInputText(msg.content || ""); }}>
                          <Edit2 className="w-4 h-4 mr-2" /> Edit
                        </ContextMenuItem>
                        <ContextMenuItem className="text-destructive" onClick={() => deleteMessage.mutate({ messageId: msg.id })}>
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </ContextMenuItem>
                      </>
                    )}
                    <div className="p-2 flex justify-between">
                      {EMOJIS.map(emoji => (
                        <button 
                          key={emoji} 
                          className="hover:scale-125 transition-transform"
                          onClick={() => {
                            const hasReacted = msg.reactions?.some(r => r.userId === me?.id && r.emoji === emoji);
                            if (hasReacted) {
                              removeReaction.mutate({ messageId: msg.id, emoji });
                            } else {
                              addReaction.mutate({ messageId: msg.id, data: { emoji } });
                            }
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </ContextMenuContent>
                </ContextMenu>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="p-4 bg-background/80 backdrop-blur-xl border-t border-border z-10">
        {editingId && (
          <div className="flex items-center justify-between bg-muted/50 p-2 rounded-t-xl text-sm border-b border-border">
            <span className="text-muted-foreground flex items-center gap-2"><Edit2 className="w-4 h-4"/> Editing message</span>
            <button onClick={() => { setEditingId(null); setInputText(""); }}><X className="w-4 h-4"/></button>
          </div>
        )}
        <div className="relative flex items-center">
          <Input 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className={`pr-12 bg-input/50 border-border h-12 text-base ${editingId ? 'rounded-b-xl rounded-t-none border-t-0' : 'rounded-full'}`}
          />
          <Button 
            size="icon" 
            className="absolute right-1 w-10 h-10 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={handleSend}
            disabled={!inputText.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </>
  );
}

// simple debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

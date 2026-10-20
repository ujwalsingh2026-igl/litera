import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import {
  Search,
  Image as ImageIcon,
  Sparkles,
  Link2,
  Check,
  Loader2,
  Globe,
} from 'lucide-react';
import { useToast } from '../ui/Toast';

export interface OnlineImageItem {
  id: string;
  title: string;
  thumbUrl: string;
  fullUrl: string;
  author?: string;
  source: 'wikimedia' | 'curated' | 'url';
}

interface OnlineImageSeekerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertImage: (url: string, altText?: string) => void;
}

const CURATED_CATEGORIES = [
  { label: 'Ancient Library', query: 'ancient library books parchment' },
  { label: 'Fantasy Castle', query: 'fantasy castle medieval mountains' },
  { label: 'Mystic Forest', query: 'mystic forest fog sunlight trees' },
  { label: 'Cyberpunk & Sci-Fi', query: 'cyberpunk city neon lights futuristic' },
  { label: 'Vintage Writing', query: 'vintage typewriter quill manuscript ink' },
  { label: 'Cosmic Nebula', query: 'hubble nebula space galaxy stars' },
  { label: 'Gothic Architecture', query: 'gothic cathedral stone gargoyle architecture' },
  { label: 'Ocean & Storm', query: 'ocean storm waves lighthouse clouds' },
];

const CURATED_SHOWCASE: OnlineImageItem[] = [
  {
    id: 'curated-1',
    title: 'The Great Reading Room & Books',
    thumbUrl: 'https://images.unsplash.com/photo-1507842229451-7723e757a292?auto=format&fit=crop&w=800&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1507842229451-7723e757a292?auto=format&fit=crop&w=1600&q=85',
    author: 'Unsplash Archival',
    source: 'curated',
  },
  {
    id: 'curated-2',
    title: 'Vintage Quill, Inkwell and Parchment',
    thumbUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=800&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1600&q=85',
    author: 'Literary Heritage',
    source: 'curated',
  },
  {
    id: 'curated-3',
    title: 'Misty Alpine Castle Peaks',
    thumbUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1600&q=85',
    author: 'Alpine Chronicle',
    source: 'curated',
  },
  {
    id: 'curated-4',
    title: 'Deep Celestial Nebula',
    thumbUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=85',
    author: 'Cosmic Frontier',
    source: 'curated',
  },
  {
    id: 'curated-5',
    title: 'Old World Victorian Manor',
    thumbUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1600&q=85',
    author: 'Historical Archives',
    source: 'curated',
  },
  {
    id: 'curated-6',
    title: 'Enchanted Woodland Sunlight',
    thumbUrl: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=800&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1600&q=85',
    author: 'Wild Solitude',
    source: 'curated',
  },
];

export const OnlineImageSeekerModal: React.FC<OnlineImageSeekerModalProps> = ({
  isOpen,
  onClose,
  onInsertImage,
}) => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'seek' | 'url'>('seek');
  const [searchQuery, setSearchQuery] = useState('ancient library');
  const [isLoading, setIsLoading] = useState(false);
  const [images, setImages] = useState<OnlineImageItem[]>(CURATED_SHOWCASE);
  const [selectedImage, setSelectedImage] = useState<OnlineImageItem | null>(CURATED_SHOWCASE[0]);
  const [captionInput, setCaptionInput] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [previewError, setPreviewError] = useState(false);

  const fetchWikimediaImages = async (query: string) => {
    if (!query.trim()) return;
    setIsLoading(true);
    try {
      const endpoint = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        query
      )}&gsrnamespace=6&prop=imageinfo&iiprop=url|size|thumbmime&iiurlwidth=800&format=json&origin=*`;

      const res = await fetch(endpoint);
      const data = await res.json();
      const pages = data.query?.pages || {};

      const list: OnlineImageItem[] = Object.values(pages)
        .map((p: any) => {
          const info = p.imageinfo?.[0];
          const rawTitle = (p.title || '').replace(/^File:/, '').replace(/\.[^.]+$/, '');
          return {
            id: `wiki-${p.pageid || Math.random()}`,
            title: rawTitle.length > 50 ? `${rawTitle.slice(0, 48)}...` : rawTitle,
            thumbUrl: info?.thumburl || info?.url || '',
            fullUrl: info?.url || info?.thumburl || '',
            author: 'Wikimedia Commons (Public Domain / CC)',
            source: 'wikimedia' as const,
          };
        })
        .filter(
          (img: OnlineImageItem) =>
            img.thumbUrl &&
            !img.thumbUrl.endsWith('.svg') &&
            !img.thumbUrl.endsWith('.pdf') &&
            !img.thumbUrl.endsWith('.ogg')
        );

      if (list.length > 0) {
        setImages(list);
        setSelectedImage(list[0]);
        setCaptionInput(list[0].title);
      } else {
        // Fall back to curated collection if query returned no direct matches
        setImages(CURATED_SHOWCASE);
        setSelectedImage(CURATED_SHOWCASE[0]);
      }
    } catch (e) {
      console.warn('[ImageSeeker] Online search fallback to curated showcase:', e);
      setImages(CURATED_SHOWCASE);
      setSelectedImage(CURATED_SHOWCASE[0]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (images.length === 0 || images === CURATED_SHOWCASE) {
        fetchWikimediaImages(searchQuery);
      }
    }
  }, [isOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchWikimediaImages(searchQuery);
  };

  const handleSelectCategory = (catQuery: string) => {
    setSearchQuery(catQuery);
    fetchWikimediaImages(catQuery);
  };

  const handleInsert = () => {
    let finalUrl = '';
    let finalAlt = '';

    if (activeTab === 'url') {
      if (!customUrl.trim()) {
        toast.warning('Please enter an image URL.');
        return;
      }
      finalUrl = customUrl.trim();
      finalAlt = captionInput.trim() || 'Online manuscript illustration';
    } else {
      if (!selectedImage) {
        toast.warning('Please select an image to insert.');
        return;
      }
      finalUrl = selectedImage.fullUrl || selectedImage.thumbUrl;
      finalAlt = captionInput.trim() || selectedImage.title;
    }

    onInsertImage(finalUrl, finalAlt);
    toast.success('✓ Image successfully inserted into manuscript!');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🖼️ Online Image Seeker Studio"
      size="xl"
    >
      <div className="space-y-4">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-2 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('seek')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                activeTab === 'seek'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Royalty-Free Image Search</span>
            </button>
            <button
              onClick={() => setActiveTab('url')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                activeTab === 'url'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Direct Web Image URL</span>
            </button>
          </div>

          <span className="text-[11px] text-stone-400 hidden sm:inline">
            High-Resolution Creative Commons & Curated Arts
          </span>
        </div>

        {activeTab === 'seek' ? (
          <>
            {/* Search Bar */}
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search imagery (e.g. ancient castle, cyberpunk street, dark forest, vintage quill)..."
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 font-sans"
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="gap-1.5 px-4"
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span>Search</span>
              </Button>
            </form>

            {/* Quick Inspiration Categories */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              <span className="text-[11px] font-semibold text-stone-500 shrink-0 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" /> Presets:
              </span>
              {CURATED_CATEGORIES.map((cat) => (
                <button
                  key={cat.label}
                  type="button"
                  onClick={() => handleSelectCategory(cat.query)}
                  className="px-2.5 py-1 text-[11px] rounded-full border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/60 hover:border-amber-500 hover:text-amber-700 dark:hover:text-amber-300 whitespace-nowrap transition"
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Results Grid & Preview Split */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-[340px]">
              {/* Image Grid */}
              <div className="md:col-span-8 overflow-y-auto pr-1 space-y-2 border border-stone-200 dark:border-stone-800 rounded-xl p-2 bg-stone-50/50 dark:bg-stone-900/40">
                {isLoading ? (
                  <div className="h-full flex flex-col items-center justify-center text-stone-400 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                    <span className="text-xs font-serif">Seeking high-resolution literary archives...</span>
                  </div>
                ) : images.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-stone-400 text-xs font-serif">
                    No images found for this query. Try one of the inspiration presets above!
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {images.map((img) => {
                      const isSelected = selectedImage?.id === img.id;
                      return (
                        <div
                          key={img.id}
                          onClick={() => {
                            setSelectedImage(img);
                            setCaptionInput(img.title);
                          }}
                          className={`group relative aspect-video rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                            isSelected
                              ? 'border-amber-600 ring-2 ring-amber-500/40 shadow-md scale-[1.02]'
                              : 'border-transparent hover:border-stone-300 dark:hover:border-stone-700'
                          }`}
                        >
                          <img
                            src={img.thumbUrl}
                            alt={img.title}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-end text-[10px] text-white">
                            <span className="line-clamp-1 font-medium">{img.title}</span>
                          </div>
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center shadow">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected Image Detail & Caption Sidebar */}
              <div className="md:col-span-4 border border-stone-200 dark:border-stone-800 rounded-xl p-3 flex flex-col justify-between bg-white dark:bg-stone-900">
                {selectedImage ? (
                  <div className="space-y-3">
                    <div className="relative aspect-video rounded-lg overflow-hidden border border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-800">
                      <img
                        src={selectedImage.fullUrl || selectedImage.thumbUrl}
                        alt={selectedImage.title}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs font-serif font-bold text-stone-900 dark:text-stone-100 line-clamp-2">
                        {selectedImage.title}
                      </div>
                      <div className="text-[10px] text-stone-500 dark:text-stone-400">
                        {selectedImage.author}
                      </div>
                    </div>

                    <div className="space-y-1 pt-1 border-t border-stone-100 dark:border-stone-800">
                      <label className="text-[11px] font-medium text-stone-700 dark:text-stone-300">
                        Manuscript Caption / Alt:
                      </label>
                      <input
                        type="text"
                        value={captionInput}
                        onChange={(e) => setCaptionInput(e.target.value)}
                        placeholder="Optional caption..."
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 focus:ring-1 focus:ring-amber-500 outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-stone-400 text-xs">
                    Select an image to preview
                  </div>
                )}

                <div className="pt-2 border-t border-stone-200 dark:border-stone-800 flex gap-2">
                  <Button variant="secondary" size="sm" onClick={onClose} className="flex-1">
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleInsert}
                    disabled={!selectedImage}
                    className="flex-1 gap-1"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Insert</span>
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Direct Image URL Tab */
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-stone-800 dark:text-stone-200">
                Direct Image Web Link (HTTPS URL):
              </label>
              <input
                type="url"
                value={customUrl}
                onChange={(e) => {
                  setCustomUrl(e.target.value);
                  setPreviewError(false);
                }}
                placeholder="https://example.com/illustrations/chapter-cover.jpg"
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 focus:ring-2 focus:ring-amber-500 outline-none font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-stone-800 dark:text-stone-200">
                Manuscript Caption / Description:
              </label>
              <input
                type="text"
                value={captionInput}
                onChange={(e) => setCaptionInput(e.target.value)}
                placeholder="Figure 1: The Library at Dawn..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            {/* URL Live Preview */}
            {customUrl && (
              <div className="p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/40 space-y-2">
                <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-300">
                  Live Preview:
                </span>
                <div className="aspect-video max-h-48 rounded-lg overflow-hidden border border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-950 flex items-center justify-center">
                  {!previewError ? (
                    <img
                      src={customUrl}
                      alt="URL Preview"
                      onError={() => setPreviewError(true)}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-xs text-red-500 flex items-center gap-1.5">
                      Could not load image from this URL. Please check the link.
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-stone-200 dark:border-stone-800 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleInsert} className="gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Insert into Manuscript</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

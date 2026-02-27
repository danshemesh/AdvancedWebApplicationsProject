import { useState } from 'react';
import { apiRequest } from '../api/client';

interface Post {
  _id: string;
  content: string;
  senderId: { _id: string; username: string; profilePicturePath?: string };
  createdAt: string;
  commentCount: number;
  likeCount: number;
  likedByCurrentUser: boolean;
  imagePath?: string;
  searchReason?: string;
}

interface SearchResponse {
  posts: Post[];
  query: string;
}

interface SearchBoxProps {
  onSearchResults: (posts: Post[] | null, query: string) => void;
  isSearchMode: boolean;
}

export default function SearchBox({ onSearchResults, isSearchMode }: SearchBoxProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSearch() {
    const trimmed = query.trim();
    if (!trimmed) {
      onSearchResults(null, '');
      return;
    }

    setLoading(true);
    setError('');

    const { data, ok, status } = await apiRequest<SearchResponse & { error?: string }>(
      `/ai/search?q=${encodeURIComponent(trimmed)}`
    );

    setLoading(false);

    if (ok && data) {
      onSearchResults(data.posts, trimmed);
    } else if (status === 429) {
      setError('Rate limit exceeded. Try again in a minute.');
    } else if (data?.error) {
      setError(data.error);
    } else {
      setError('Search failed. Please try again.');
    }
  }

  function handleClear() {
    setQuery('');
    setError('');
    onSearchResults(null, '');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }

  return (
    <div className="search-box">
      <div className="search-input-wrapper">
        <input
          type="text"
          placeholder="Search posts with AI..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="search-input"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="search-clear-btn"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={handleSearch}
        disabled={loading || !query.trim()}
        className="search-btn btn-primary"
      >
        {loading ? 'Searching…' : 'Search'}
      </button>
      {isSearchMode && (
        <button
          type="button"
          onClick={handleClear}
          className="back-to-feed-btn"
        >
          ← Back to Feed
        </button>
      )}
      {error && <p className="error search-error">{error}</p>}
    </div>
  );
}

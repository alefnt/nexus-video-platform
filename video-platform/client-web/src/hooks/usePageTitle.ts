/**
 * usePageTitle — Sets document.title and OG meta for each page
 *
 * Usage:
 *   usePageTitle(t('nav.home'));
 *   usePageTitle(t('nav.home'), 'Explore trending content on Nexus');
 */

import { useEffect } from 'react';
import { setPageSEO } from '../utils/seo';

/**
 * Set the page title and optional SEO metadata.
 * Call once at the top of each page component.
 */
export function usePageTitle(title: string, description?: string): void {
    useEffect(() => {
        if (title) {
            setPageSEO({ title, description });
        }
    }, [title, description]);
}

export default usePageTitle;

/**
 * Copyright (C) 2023 Gnuxie <Gnuxie@protonmail.com>
 * All rights reserved.
 */

import { traceSync } from "../../utils";
import { DocumentNode } from "./DeadDocument";

/**
 * Ideally this would call a callback when a page is ready
 * Unfortunatley there's no way to do that (and await) without making the stream
 * all async. Which is annoying af.
 * Therefore it's necessary for the stream to queue pages
 */

export class PagedDuplexStream {
    private buffer = '';
    private pages: string[] = [''];

    private lastCommittedNode?: DocumentNode;
    constructor(
        public readonly sizeLimit = 20000
    ) {
    }

    private get currentPage(): string {
        return this.pages.at(this.pages.length - 1)!;
    }

    @traceSync('PagedDuplexStream.appendToCurrentPage')
    private appendToCurrentPage(string: string) {
        const currentIndex = this.pages.length - 1;
        this.pages[currentIndex] = this.pages[currentIndex] + string;
    }

    @traceSync('PagedDuplexStream.writeString')
    public writeString(string: string): PagedDuplexStream {
        this.buffer += string;
        return this;
    }

    @traceSync('PagedDuplexStream.getPosition')
    public getPosition(): number {
        return this.buffer.length;
    }

    @traceSync('PagedDuplexStream.isPageAndBufferOverSize')
    public isPageAndBufferOverSize(): boolean {
        return (this.currentPage.length + this.buffer.length) > this.sizeLimit;
    }

    /**
     * Creates a new page from the previously committed text
     * @returns A page with all committed text.
     */
    @traceSync('PagedDuplexStream.ensureNewPage')
    public ensureNewPage(): void {
        if (this.currentPage.length !== 0) {
            this.pages.push('');
        }
    }

    /**
     * Commit the buffered text to the current page.
     * If the buffered text is over the `sizeLimit`, then the current
     * page will be returned first, and then replaced with a new one in order
     * to commit the buffer.
     * @param node A DocumentNode to associate with the commit.
     * @throws TypeError if the buffer is larger than the `sizeLimit`.
     * @returns A page if the buffered text will force the current page to go over the size limit.
     */
    @traceSync('PagedDuplexStream.commit')
    public commit(node: DocumentNode): void {
        if (this.isPageAndBufferOverSize()) {
            if (this.currentPage.length === 0 && (this.buffer.length > this.sizeLimit)) {
                throw new TypeError('Commit is too large, could not write a page for this commit');
            }
            this.ensureNewPage();
        }
        this.appendToCurrentPage(this.buffer);
        this.buffer = '';
        this.lastCommittedNode = node;
    }

    @traceSync('PagedDuplexStream.getLastCommittedNode')
    public getLastCommittedNode(): DocumentNode | undefined {
        return this.lastCommittedNode;
    }

    @traceSync('PagedDuplexStream.peekPage')
    public peekPage(): string | undefined {
        // We consider a page "ready" when it is no longer the current page.
        if (this.pages.length < 2) {
            return undefined;
        }
        return this.pages.at(0);
    }

    @traceSync('PagedDuplexStream.readPage')
    public readPage(): string | undefined {
        // We consider a page "ready" when it is no longer the current page.
        if (this.pages.length < 2) {
            return undefined;
        }
        return this.pages.shift();
    }
}

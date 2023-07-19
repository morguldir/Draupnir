/**
 * Copyright (C) 2022 Gnuxie <Gnuxie@protonmail.com>
 * All rights reserved.
 *
 * This file is modified and is NOT licensed under the Apache License.
 * This modified file incorperates work from mjolnir
 * https://github.com/matrix-org/mjolnir
 * which included the following license notice:

Copyright 2019 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
 *
 * However, this file is modified and the modifications in this file
 * are NOT distributed, contributed, committed, or licensed under the Apache License.
 */

import { MatrixGlob } from "matrix-bot-sdk";
import { setToArray, traceSync } from "../utils";

export interface ServerAclContent {
    allow: string[];
    deny: string[];
    allow_ip_literals: boolean;
}

export class ServerAcl {
    private allowedServers: Set<string> = new Set<string>();
    private deniedServers: Set<string> = new Set<string>();
    private allowIps = false;

    public constructor(public readonly homeserver: string) {

    }

    /**
     * Checks the ACL for any entries that might ban ourself.
     * @returns A list of deny entries that will not ban our own homeserver.
     */
    @traceSync("ServerAcl.safeDeniedServers")
    public safeDeniedServers(): string[] {
        // The reason we do this check here rather than in the `denyServer` method
        // is because `literalAclContent` exists and also we want to be defensive about someone
        // mutating `this.deniedServers` via another method in the future.
        const entries: string[] = []
        for (const server of this.deniedServers) {
            const glob = new MatrixGlob(server);
            if (!glob.test(this.homeserver)) {
                entries.push(server);
            }
        }
        return entries;
    }

    @traceSync("ServerAcl.allowIpAddresses")
    public allowIpAddresses(): ServerAcl {
        this.allowIps = true;
        return this;
    }

    @traceSync("ServerAcl.denyIpAddresses")
    public denyIpAddresses(): ServerAcl {
        this.allowIps = false;
        return this;
    }

    @traceSync("ServerAcl.allowServer")
    public allowServer(glob: string): ServerAcl {
        this.allowedServers.add(glob);
        return this;
    }

    @traceSync("ServerAcl.setAllowedServers")
    public setAllowedServers(globs: string[]): ServerAcl {
        this.allowedServers = new Set<string>(globs);
        return this;
    }

    @traceSync("ServerAcl.denyServer")
    public denyServer(glob: string): ServerAcl {
        this.deniedServers.add(glob);
        return this;
    }

    @traceSync("ServerAcl.setDeniedServers")
    public setDeniedServers(globs: string[]): ServerAcl {
        this.deniedServers = new Set<string>(globs);
        return this;
    }

    @traceSync("ServerAcl.literalAclContent")
    public literalAclContent(): ServerAclContent {
        return {
            allow: setToArray(this.allowedServers),
            deny: setToArray(this.deniedServers),
            allow_ip_literals: this.allowIps,
        };
    }

    @traceSync("ServerAcl.safeAclContent")
    public safeAclContent(): ServerAclContent {
        const allowed = setToArray(this.allowedServers);
        if (!allowed || allowed.length === 0) {
            allowed.push("*"); // allow everything
        }
        return {
            allow: allowed,
            deny: this.safeDeniedServers(),
            allow_ip_literals: this.allowIps,
        };
    }

    @traceSync("ServerAcl.matches")
    public matches(acl: any): boolean {
        if (!acl) return false;

        const allow = acl['allow'];
        const deny = acl['deny'];
        const ips = acl['allow_ip_literals'];

        let allowMatches = true; // until proven false
        let denyMatches = true; // until proven false
        let ipsMatch = ips === this.allowIps;

        const currentAllowed = setToArray(this.allowedServers);
        if (allow.length === currentAllowed.length) {
            for (const s of allow) {
                if (!currentAllowed.includes(s)) {
                    allowMatches = false;
                    break;
                }
            }
        } else allowMatches = false;

        const currentDenied = setToArray(this.deniedServers);
        if (deny.length === currentDenied.length) {
            for (const s of deny) {
                if (!currentDenied.includes(s)) {
                    denyMatches = false;
                    break;
                }
            }
        } else denyMatches = false;

        return denyMatches && allowMatches && ipsMatch;
    }
}

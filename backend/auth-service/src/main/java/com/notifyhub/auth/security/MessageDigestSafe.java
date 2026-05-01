package com.notifyhub.auth.security;

import java.security.MessageDigest;

final class MessageDigestSafe {

    private MessageDigestSafe() {
    }

    static boolean equals(byte[] left, byte[] right) {
        return MessageDigest.isEqual(left, right);
    }
}

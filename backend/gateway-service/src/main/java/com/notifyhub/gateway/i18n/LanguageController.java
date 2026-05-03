package com.notifyhub.gateway.i18n;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/i18n")
class LanguageController {

    private final LanguageService languageService;

    LanguageController(LanguageService languageService) {
        this.languageService = languageService;
    }

    @GetMapping("/messages")
    LanguageMessagesResponse messages(
            @RequestParam(name = "language", required = false) String language,
            @RequestHeader(name = "Accept-Language", required = false) String acceptLanguage
    ) {
        return languageService.messages(language == null ? acceptLanguage : language);
    }
}

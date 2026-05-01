package com.notifyhub.reminder.api;

import com.notifyhub.common.ServiceNames;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal")
class ServiceInfoController {

    @GetMapping("/info")
    ServiceInfo serviceInfo() {
        return new ServiceInfo(ServiceNames.REMINDER, "foundation");
    }

    record ServiceInfo(String service, String phase) {
    }
}

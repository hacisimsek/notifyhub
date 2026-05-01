package com.notifyhub.notification.api;

import com.notifyhub.common.ServiceNames;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal")
class ServiceInfoController {

    @GetMapping("/info")
    ServiceInfo serviceInfo() {
        return new ServiceInfo(ServiceNames.NOTIFICATION, "foundation");
    }

    record ServiceInfo(String service, String phase) {
    }
}

package com.notifyhub.reminder;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "com.notifyhub")
public class ReminderServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(ReminderServiceApplication.class, args);
    }
}

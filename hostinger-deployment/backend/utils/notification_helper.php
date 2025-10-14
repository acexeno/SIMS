<?php
/**
 * Notification Helper for Supplier Management
 * Handles sending notifications to suppliers via various channels
 */

/**
 * Send a notification to a supplier
 * 
 * @param array $data Notification data including:
 *   - to: Email address or contact info
 *   - subject: Email subject
 *   - message: Notification message
 *   - supplier_id: ID of the supplier
 *   - notification_id: ID of the notification record
 * @return bool True if notification was sent successfully, false otherwise
 */
function sendSupplierNotification($data) {
    // In a production environment, this would integrate with email/SMS services
    // For now, we'll just log the notification
    
    $logDir = __DIR__ . '/../../logs';
    if (!file_exists($logDir)) {
        mkdir($logDir, 0755, true);
    }
    
    $logMessage = sprintf(
        "[%s] Notification sent to supplier #%d (ID: %d)\n" .
        "To: %s\n" .
        "Subject: %s\n" .
        "Message: %s\n\n",
        date('Y-m-d H:i:s'),
        $data['supplier_id'],
        $data['notification_id'],
        $data['to'],
        $data['subject'],
        $data['message']
    );
    
    file_put_contents("$logDir/supplier_notifications.log", $logMessage, FILE_APPEND);
    
    // Simulate sending the notification (in a real app, this would be an actual email/SMS)
    return true;
}

/**
 * Get notification templates for different supplier events
 * 
 * @param string $eventType Type of event (e.g., 'order_placed', 'payment_reminder')
 * @param array $data Template variables
 * @return array|false Template data (subject, message) or false if not found
 */
function getNotificationTemplate($eventType, $data = []) {
    $templates = [
        'order_placed' => [
            'subject' => 'New Order #%order_number% - Action Required',
            'message' => "Dear %supplier_name%,\n\n" .
                        "We have placed a new order with the following details:\n\n" .
                        "Order Number: %order_number%\n" .
                        "Order Date: %order_date%\n" .
                        "Expected Delivery: %expected_date%\n" .
                        "Total Amount: %total_amount%\n\n" .
                        "Please confirm receipt of this order at your earliest convenience.\n\n" .
                        "Thank you,\nBuildIT Team"
        ],
        'payment_reminder' => [
            'subject' => 'Payment Reminder for Invoice #%invoice_number%',
            'message' => "Dear %supplier_name%,\n\n" .
                        "This is a friendly reminder that payment for Invoice #%invoice_number% " .
                        "is due on %due_date%.\n\n" .
                        "Invoice Amount: %amount%\n" .
                        "Due Date: %due_date%\n" .
                        "Payment Method: %payment_method%\n\n" .
                        "Please ensure payment is processed by the due date to avoid any service interruptions.\n\n" .
                        "Thank you for your prompt attention to this matter.\n\n" .
                        "Best regards,\nBuildIT Team"
        ],
        'inventory_alert' => [
            'subject' => 'Low Stock Alert for %component_name%',
            'message' => "Dear %supplier_name%,\n\n" .
                        "Our inventory levels for the following component are running low:\n\n" .
                        "Component: %component_name%\n" .
                        "Current Stock: %current_stock%\n" .
                        "Reorder Level: %reorder_level%\n\n" .
                        "We would like to place an order to replenish our stock. Please provide your " .
                        "current availability and estimated delivery time for %quantity% units.\n\n" .
                        "Thank you for your prompt response.\n\n" .
                        "Best regards,\nBuildIT Team"
        ],
        'general' => [
            'subject' => '%subject%',
            'message' => 'Dear %supplier_name%,\n\n%message%\n\nBest regards,\nBuildIT Team'
        ]
    ];
    
    if (!isset($templates[$eventType])) {
        return false;
    }
    
    $template = $templates[$eventType];
    
    // Replace placeholders with actual values
    foreach ($data as $key => $value) {
        $template['subject'] = str_replace("%$key%", $value, $template['subject']);
        $template['message'] = str_replace("%$key%", $value, $template['message']);
    }
    
    return $template;
}

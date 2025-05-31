import { Component, OnInit } from '@angular/core';
import { ToastService } from 'src/app/services/toast.service';

@Component({
  selector: 'app-admin-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class AdminSettingsComponent implements OnInit {

  // System Settings
  systemSettings = {
    siteName: 'DevBridge Admin',
    siteDescription: 'Project Management System',
    maintenanceMode: false,
    allowRegistration: true,
    emailVerificationRequired: true,
    maxFileUploadSize: 10, // MB
    sessionTimeout: 30, // minutes
    defaultUserRole: 'student',
    passwordMinLength: 8,
    passwordRequireSpecialChars: true
  };

  // Email Settings
  emailSettings = {
    smtpHost: '',
    smtpPort: 587,
    smtpUsername: '',
    smtpPassword: '',
    smtpSecure: true,
    fromEmail: '',
    fromName: 'DevBridge Team'
  };

  // Security Settings
  securitySettings = {
    enableTwoFactor: false,
    maxLoginAttempts: 5,
    lockoutDuration: 15, // minutes
    passwordExpiry: 90, // days
    enableAuditLog: true,
    enableIpWhitelist: false,
    allowedIps: [] as string[]
  };

  // Backup Settings
  backupSettings = {
    autoBackup: true,
    backupFrequency: 'daily',
    backupRetention: 30, // days
    backupLocation: 'cloud',
    lastBackup: new Date()
  };

  // UI State
  activeTab = 'system';
  loading = false;
  saving = false;

  constructor(
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings(): void {
    this.loading = true;
    // In a real app, load settings from API
    setTimeout(() => {
      this.loading = false;
    }, 1000);
  }

  saveSettings(settingsType: string): void {
    this.saving = true;

    // Simulate API call
    setTimeout(() => {
      this.saving = false;
      this.toastService.showSuccess(`${settingsType} settings saved successfully!`);
    }, 1500);
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  // System Actions
  toggleMaintenanceMode(): void {
    this.systemSettings.maintenanceMode = !this.systemSettings.maintenanceMode;
    const status = this.systemSettings.maintenanceMode ? 'enabled' : 'disabled';
    this.toastService.showInfo(`Maintenance mode ${status}`);
  }

  clearCache(): void {
    this.toastService.showSuccess('System cache cleared successfully!');
  }

  restartSystem(): void {
    if (confirm('Are you sure you want to restart the system? This will temporarily interrupt service.')) {
      this.toastService.showInfo('System restart initiated...');
    }
  }

  // Backup Actions
  createBackup(): void {
    this.toastService.showInfo('Creating backup... This may take a few minutes.');
    setTimeout(() => {
      this.backupSettings.lastBackup = new Date();
      this.toastService.showSuccess('Backup created successfully!');
    }, 3000);
  }

  restoreBackup(): void {
    if (confirm('Are you sure you want to restore from backup? This will overwrite current data.')) {
      this.toastService.showInfo('Restoring from backup...');
    }
  }

  // Security Actions
  generateApiKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  addIpToWhitelist(ip: string): void {
    if (ip && !this.securitySettings.allowedIps.includes(ip)) {
      this.securitySettings.allowedIps.push(ip);
      this.toastService.showSuccess(`IP ${ip} added to whitelist`);
    }
  }

  removeIpFromWhitelist(ip: string): void {
    const index = this.securitySettings.allowedIps.indexOf(ip);
    if (index > -1) {
      this.securitySettings.allowedIps.splice(index, 1);
      this.toastService.showSuccess(`IP ${ip} removed from whitelist`);
    }
  }

  // Email Actions
  testEmailConnection(): void {
    this.toastService.showInfo('Testing email connection...');
    setTimeout(() => {
      this.toastService.showSuccess('Email connection test successful!');
    }, 2000);
  }

  sendTestEmail(): void {
    this.toastService.showInfo('Sending test email...');
    setTimeout(() => {
      this.toastService.showSuccess('Test email sent successfully!');
    }, 2000);
  }

  // Export/Import Settings
  exportSettings(): void {
    const settings = {
      system: this.systemSettings,
      email: this.emailSettings,
      security: this.securitySettings,
      backup: this.backupSettings
    };

    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'admin-settings.json';
    link.click();
    URL.revokeObjectURL(url);

    this.toastService.showSuccess('Settings exported successfully!');
  }

  importSettings(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const settings = JSON.parse(e.target?.result as string);
          if (settings.system) this.systemSettings = { ...this.systemSettings, ...settings.system };
          if (settings.email) this.emailSettings = { ...this.emailSettings, ...settings.email };
          if (settings.security) this.securitySettings = { ...this.securitySettings, ...settings.security };
          if (settings.backup) this.backupSettings = { ...this.backupSettings, ...settings.backup };

          this.toastService.showSuccess('Settings imported successfully!');
        } catch (error) {
          this.toastService.showError('Invalid settings file format');
        }
      };
      reader.readAsText(file);
    }
  }
}

import { Component, OnInit } from '@angular/core';
import { LoggerService } from './services/logger.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  title = 'frontend';

  constructor(private logger: LoggerService) {}

  ngOnInit() {
    // Activer les logs
    this.logger.setLogsEnabled(true);

    // Activer les logs pour certains composants spécifiques
    this.logger.enableComponentLogs('MessageService');
    this.logger.enableComponentLogs('MessageChat');
  }
}

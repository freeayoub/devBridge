import { Component, OnInit } from '@angular/core';
import { LoggerService } from './services/logger.service';
import { Observable } from 'rxjs';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  title = 'frontend';
  isDarkMode$: Observable<boolean>;
  constructor(
    private logger: LoggerService,
    private themeService: ThemeService
  ) {
    this.isDarkMode$ = this.themeService.darkMode$;
  }

  ngOnInit() {
    // Activer les logs
    this.logger.setLogsEnabled(true);

    // Activer les logs pour certains composants spécifiques
    this.logger.enableComponentLogs('MessageService');
    this.logger.enableComponentLogs('MessageChat');
  }
}

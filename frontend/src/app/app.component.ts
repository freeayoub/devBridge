import { Component, OnInit } from '@angular/core';
<<<<<<< HEAD
import { LoggerService } from './services/logger.service';
=======
import { Observable } from 'rxjs';
import { ThemeService } from './shared/theme.service';
>>>>>>> 529d335ac204b46aff690c931b4ea4cc979f0d19

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
<<<<<<< HEAD
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
=======
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'frontend';
  isDarkMode$: Observable<boolean>;

  constructor(private themeService: ThemeService) {
    this.isDarkMode$ = this.themeService.darkMode$;
  }

  ngOnInit(): void {
    // Any initialization logic
>>>>>>> 529d335ac204b46aff690c931b4ea4cc979f0d19
  }
}

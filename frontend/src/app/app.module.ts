import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
<<<<<<< HEAD
import { JwtModule, JWT_OPTIONS } from '@auth0/angular-jwt';
import { environment } from 'src/environments/environment';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { GraphQLModule } from './graphql.module';
import { ApolloModule } from 'apollo-angular';
import { CallModule } from './components/call/call.module';
import { ConnectionStatusModule } from './components/connection-status/connection-status.module';
import { GraphqlStatusModule } from './components/graphql-status/graphql-status.module';
import { VoiceMessageModule } from './components/voice-message/voice-message.module';
// Factory simplifiée sans injection de JwtHelperService
export function jwtOptionsFactory() {
  return {
    tokenGetter: () => {
      if (!environment.production) {
        console.debug('JWT token retrieved from storage');
      }
      return localStorage.getItem('token');
    },
    allowedDomains: [new URL(environment.urlBackend).hostname],
    disallowedRoutes: [`${new URL(environment.urlBackend).origin}/users/login`],
  };
}

=======
import { DashboardComponent } from './admin/dashboard/dashboard.component';
import { ProfileComponent } from './admin/profile/profile.component';
import { HomeComponent } from './home/home.component';
import { NavbarComponent } from './shared/navbar/navbar.component';
import { DashboardComponent as UserDashboardComponent } from './user/dashboard/dashboard.component';
>>>>>>> 529d335ac204b46aff690c931b4ea4cc979f0d19
@NgModule({
  declarations: [
    AppComponent,
    DashboardComponent,
    HomeComponent,
    NavbarComponent,
    UserDashboardComponent,
    ProfileComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    ReactiveFormsModule,
    FormsModule,
<<<<<<< HEAD
    HttpClientModule,
    BrowserAnimationsModule,
    JwtModule.forRoot({
      jwtOptionsProvider: {
        provide: JWT_OPTIONS,
        useFactory: jwtOptionsFactory,
      },
    }),
    GraphQLModule,
    ApolloModule,
    CallModule,
    ConnectionStatusModule,
    GraphqlStatusModule,
    VoiceMessageModule,
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
=======
    HttpClientModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
>>>>>>> 529d335ac204b46aff690c931b4ea4cc979f0d19

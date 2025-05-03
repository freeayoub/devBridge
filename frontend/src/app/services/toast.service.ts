import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Toast  } from 'src/app/models/message.model';
@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastsSubject = new BehaviorSubject<Toast[]>([]);
  toasts$ = this.toastsSubject.asObservable();
  private currentId = 0;

  constructor() { }

  show(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', duration = 5000) {
    const id = this.currentId++;
    const toast: Toast = { id, type, message, duration };
    const currentToasts = this.toastsSubject.value;
    this.toastsSubject.next([...currentToasts, toast]);

    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
  }

  showSuccess(message: string, duration = 3000) {
    this.show(message, 'success', duration);
  }

  showError(message: string, duration = 5000) {
    this.show(message, 'error', duration);
  }

  showWarning(message: string, duration = 4000) {
    this.show(message, 'warning', duration);
  }

  showInfo(message: string, duration = 3000) {
    this.show(message, 'info', duration);
  }

  dismiss(id: number) {
    const currentToasts = this.toastsSubject.value.filter(t => t.id !== id);
    this.toastsSubject.next(currentToasts);
  }

  clear() {
    this.toastsSubject.next([]);
  }
}


// toast.component.ts
// import { Component, OnInit } from '@angular/core';
// import { ToastService } from './toast.service';

// @Component({
//   selector: 'app-toast',
//   template: `
//     <div class="fixed bottom-4 right-4 z-50 space-y-2 w-80">
//       <div *ngFor="let toast of (toasts$ | async)" 
//            [class]="getToastClass(toast)"
//            class="p-4 rounded-lg shadow-lg transition-all duration-300">
//         <div class="flex items-start">
//           <div class="flex-shrink-0">
//             <i [class]="getIconClass(toast)"></i>
//           </div>
//           <div class="ml-3">
//             <p class="text-sm font-medium">{{ toast.message }}</p>
//           </div>
//           <button (click)="dismiss(toast.id!)" class="ml-auto -mx-1.5 -my-1.5">
//             <i class="fas fa-times"></i>
//           </button>
//         </div>
//       </div>
//     </div>
//   `,
//   styles: []
// })
// export class ToastComponent implements OnInit {
//   constructor(public toastService: ToastService) { }

//   ngOnInit(): void {
//   }

//   getToastClass(toast: any) {
//     const base = 'p-4 rounded-lg shadow-lg';
//     switch(toast.type) {
//       case 'success': return `${base} bg-green-50 text-green-800`;
//       case 'error': return `${base} bg-red-50 text-red-800`;
//       case 'warning': return `${base} bg-yellow-50 text-yellow-800`;
//       default: return `${base} bg-blue-50 text-blue-800`;
//     }
//   }

//   getIconClass(toast: any) {
//     switch(toast.type) {
//       case 'success': return 'fas fa-check-circle text-green-400';
//       case 'error': return 'fas fa-exclamation-circle text-red-400';
//       case 'warning': return 'fas fa-exclamation-triangle text-yellow-400';
//       default: return 'fas fa-info-circle text-blue-400';
//     }
//   }

//   dismiss(id: number) {
//     this.toastService.dismiss(id);
//   }
// }
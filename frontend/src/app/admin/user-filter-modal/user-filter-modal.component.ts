import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

@Component({
  selector: 'app-user-filter-modal',
  templateUrl: './user-filter-modal.component.html',
  styleUrls: ['./user-filter-modal.component.scss']
})
export class UserFilterModalComponent implements OnInit {
  @Input() show = false;
  @Output() close = new EventEmitter<void>();
  @Output() applyFilters = new EventEmitter<any>();

  roles = ['student', 'teacher', 'admin'];
  
  // Filter options
  roleFilter: string = '';
  statusFilter: string = '';
  verificationFilter: string = '';

  constructor() { }

  ngOnInit(): void {
  }

  apply(): void {
    const filters = {
      role: this.roleFilter,
      status: this.statusFilter,
      verification: this.verificationFilter
    };
    
    this.applyFilters.emit(filters);
    this.closeModal();
  }

  reset(): void {
    this.roleFilter = '';
    this.statusFilter = '';
    this.verificationFilter = '';
    
    this.apply();
  }

  closeModal(): void {
    this.close.emit();
  }
}

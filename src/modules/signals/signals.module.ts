import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketSignal } from './entities/market-signal.entity';
import { SignalService } from './signal.service';

@Module({
  imports: [TypeOrmModule.forFeature([MarketSignal])],
  providers: [SignalService],
  exports: [SignalService],
})
export class SignalsModule {}
